import { useState, useEffect, useCallback, useRef } from 'react';
import { IPC_CHANNELS } from '@common/types/ipc';

export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'error';
export type RecordingMode = 'toggle' | 'push-to-talk';

export interface UseRecordingOptions {
  maxDuration?: number; // 최대 녹음 시간 (초), 기본 300초
  warningBeforeEnd?: number; // 종료 전 경고 시간 (초), 기본 60초
  onWarning?: (message: string) => void; // 경고 콜백
  onMaxDurationReached?: () => void; // 최대 시간 도달 콜백
  pushToTalkThreshold?: number; // Push-to-Talk 임계값 (ms), 기본 500ms
}

interface UseRecordingResult {
  isRecording: boolean;
  status: RecordingStatus;
  duration: number;
  audioLevel: number;
  mode: RecordingMode;
  maxDuration: number;
  isWarning: boolean; // 경고 상태 (종료 임박)
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  cancelRecording: () => void;
  // Push-to-Talk 핸들러
  handleKeyDown: () => void;
  handleKeyUp: () => void;
  error: string | null;
}

const DEFAULT_MAX_DURATION = 300; // 5분
const DEFAULT_WARNING_BEFORE_END = 60; // 1분 전 경고
const DEFAULT_PUSH_TO_TALK_THRESHOLD = 500; // 500ms

/**
 * Custom hook for audio recording using MediaRecorder in renderer
 * Supports Push-to-Talk mode and max duration limit
 */
export function useRecording(options: UseRecordingOptions = {}): UseRecordingResult {
  const {
    maxDuration = DEFAULT_MAX_DURATION,
    warningBeforeEnd = DEFAULT_WARNING_BEFORE_END,
    onWarning,
    onMaxDurationReached,
    pushToTalkThreshold = DEFAULT_PUSH_TO_TALK_THRESHOLD,
  } = options;

  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<RecordingMode>('toggle');
  const [isWarning, setIsWarning] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const resolveStopRef = useRef<((audioPath: string | null) => void) | null>(null);
  
  // Push-to-Talk 관련 refs
  const keyDownTimeRef = useRef<number | null>(null);
  const warningShownRef = useRef(false);

  const isRecording = status === 'recording';

  // Cleanup function
  const cleanup = useCallback(() => {
    isRecordingRef.current = false;
    warningShownRef.current = false;
    setIsWarning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Save audio blob to main process and get file path
  const saveAudioBlob = useCallback(async (blob: Blob): Promise<string | null> => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API를 사용할 수 없습니다');
      }

      const arrayBuffer = await blob.arrayBuffer();
      const result = await window.electronAPI.invoke(
        IPC_CHANNELS.AUDIO.SAVE_BLOB,
        arrayBuffer,
        `recording-${Date.now()}.webm`
      );

      if (!result.success) {
        throw new Error(result.error || '오디오 저장 실패');
      }

      return result.data?.path || null;
    } catch (err) {
      console.error('Save audio blob error:', err);
      return null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setStatus('recording');
      isRecordingRef.current = true;
      warningShownRef.current = false;
      setIsWarning(false);
      setDuration(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Set up audio analyser for level monitoring
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Determine best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000,
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setStatus('processing');

        // Save blob to disk via IPC
        const audioPath = await saveAudioBlob(audioBlob);

        // Resolve the stop promise with the audio path
        if (resolveStopRef.current) {
          resolveStopRef.current(audioPath);
          resolveStopRef.current = null;
        }

        cleanup();
      };

      mediaRecorder.onerror = () => {
        const err = '녹음 중 오류가 발생했습니다';
        setError(err);
        setStatus('error');
        if (resolveStopRef.current) {
          resolveStopRef.current(null);
          resolveStopRef.current = null;
        }
        cleanup();
      };

      mediaRecorder.start(100); // Collect data every 100ms

      // Notify main process that recording started
      if (window.electronAPI) {
        window.electronAPI.invoke(IPC_CHANNELS.AUDIO.START_RECORDING);
      }

      // Start duration timer with max duration check
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;

          // 종료 전 경고 (기본 60초 전)
          const warningTime = maxDuration - warningBeforeEnd;
          if (newDuration === warningTime && !warningShownRef.current) {
            warningShownRef.current = true;
            setIsWarning(true);
            onWarning?.(`${warningBeforeEnd}초 후 녹음이 자동 종료됩니다`);
          }

          // 최대 시간 도달 시 자동 종료
          if (newDuration >= maxDuration) {
            if (mediaRecorderRef.current?.state === 'recording') {
              onMaxDurationReached?.();
              mediaRecorderRef.current.stop();
              
              // Notify main process
              if (window.electronAPI) {
                window.electronAPI.invoke(IPC_CHANNELS.AUDIO.STOP_RECORDING);
              }
            }
          }

          return newDuration;
        });
      }, 1000);

      // Start audio level monitoring
      const monitorAudioLevel = () => {
        if (!analyserRef.current || !isRecordingRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalizedLevel = Math.min(average / 128, 1);
        setAudioLevel(normalizedLevel);

        if (isRecordingRef.current) {
          animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
        }
      };
      monitorAudioLevel();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '녹음 시작 실패';
      setError(errorMessage);
      setStatus('error');
      console.error('Recording start error:', err);
    }
  }, [cleanup, saveAudioBlob, maxDuration, warningBeforeEnd, onWarning, onMaxDurationReached]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        resolveStopRef.current = resolve;
        mediaRecorderRef.current.stop();

        // Notify main process
        if (window.electronAPI) {
          window.electronAPI.invoke(IPC_CHANNELS.AUDIO.STOP_RECORDING);
        }
      } else {
        resolve(null);
      }
    });
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === 'recording') {
      isRecordingRef.current = false;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      setStatus('idle');
      setDuration(0);
      setMode('toggle');
      cleanup();

      if (window.electronAPI) {
        window.electronAPI.invoke(IPC_CHANNELS.AUDIO.STOP_RECORDING);
      }
    }
  }, [status, cleanup]);

  // Push-to-Talk: 키 누름 시작
  const handleKeyDown = useCallback(() => {
    if (status === 'idle') {
      keyDownTimeRef.current = Date.now();
      setMode('push-to-talk'); // 일단 Push-to-Talk로 시작
      startRecording();
    }
  }, [status, startRecording]);

  // Push-to-Talk: 키 누름 종료
  const handleKeyUp = useCallback(() => {
    if (status === 'recording' && keyDownTimeRef.current) {
      const holdDuration = Date.now() - keyDownTimeRef.current;

      if (holdDuration < pushToTalkThreshold) {
        // 짧게 누름 - Toggle 모드로 전환 (녹음 계속)
        setMode('toggle');
        keyDownTimeRef.current = null;
      } else {
        // 길게 누름 - Push-to-Talk 모드, 녹음 중지
        stopRecording();
        keyDownTimeRef.current = null;
      }
    }
  }, [status, pushToTalkThreshold, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    status,
    duration,
    audioLevel,
    mode,
    maxDuration,
    isWarning,
    startRecording,
    stopRecording,
    cancelRecording,
    handleKeyDown,
    handleKeyUp,
    error,
  };
}

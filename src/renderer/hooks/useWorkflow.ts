import { useState, useCallback } from 'react';
import { useRecording, RecordingMode, UseRecordingOptions } from './useRecording';
import { useSession } from './useSession';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { IPC_CHANNELS, TranscriptionSegment } from '@common/types/ipc';
import { Session, FormatType } from '@common/types/session';

// 시스템 알림 표시 헬퍼
const showNotification = async (title: string, body?: string) => {
  try {
    if (window.electronAPI) {
      await window.electronAPI.invoke('system:show-notification', { title, body });
    }
  } catch (err) {
    console.error('[Workflow] Notification error:', err);
  }
};

type WorkflowStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'refining'
  | 'saving'
  | 'complete'
  | 'error';

interface UseWorkflowOptions extends UseRecordingOptions {
  onAutoCopy?: (text: string) => void;
}

interface UseWorkflowResult {
  status: WorkflowStatus;
  startWorkflow: () => Promise<void>;
  stopWorkflow: () => Promise<void>;
  cancelWorkflow: () => void;
  currentSession: Session | null;
  currentSegments: TranscriptionSegment[] | null;
  currentRefinedText: string | null;
  currentFormalText: string | null;
  error: string | null;
  progress: string;
  // Recording state
  isRecording: boolean;
  duration: number;
  audioLevel: number;
  mode: RecordingMode;
  maxDuration: number;
  isWarning: boolean;
  // Push-to-Talk handlers
  handleKeyDown: () => void;
  handleKeyUp: () => void;
}

/**
 * Full recording-to-save workflow hook
 * Manages the entire process from recording to session creation
 */
export function useWorkflow(options: UseWorkflowOptions = {}): UseWorkflowResult {
  const { user } = useAuth();
  const { settings } = useSettings();
  
  // Get max duration from settings or options
  const maxDuration = settings?.maxRecordingDuration || options.maxDuration || 300;
  
  const {
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording,
    duration,
    audioLevel,
    mode,
    maxDuration: recordingMaxDuration,
    isWarning,
    handleKeyDown,
    handleKeyUp,
  } = useRecording({
    ...options,
    maxDuration,
    onMaxDurationReached: () => {
      // 최대 시간 도달 시 자동으로 워크플로우 중지
      stopWorkflowInternal();
    },
  });
  const { createSession } = useSession();

  const [status, setStatus] = useState<WorkflowStatus>('idle');
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [currentSegments, setCurrentSegments] = useState<TranscriptionSegment[] | null>(null);
  const [currentRefinedText, setCurrentRefinedText] = useState<string | null>(null);
  const [currentFormalText, setCurrentFormalText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  // Internal stop workflow (for auto-stop on max duration)
  const stopWorkflowInternal = useCallback(async () => {
    if (!user) {
      setError('사용자 정보를 찾을 수 없습니다');
      setStatus('error');
      return;
    }

    setError(null);

    try {
      // Step 1: Stop recording
      setProgress('녹음을 중지하고 저장합니다...');
      const audioPath = await stopRecording();
      
      // 녹음 종료 알림
      await showNotification('녹음 종료', '전사 및 정제 처리 중...');

      if (!audioPath) {
        throw new Error('오디오 파일 경로를 찾을 수 없습니다');
      }

      // Get settings values with defaults
      const sttProvider = settings?.preferredSTTProvider === 'elevenlabs' ? 'elevenlabs' : 'groq';
      const language = settings?.preferredLanguage || 'ko-KR';
      const formatType = settings?.pasteFormat || 'FORMATTED';
      // ElevenLabs scribe_v2는 화자 분리 기본 활성화
      const speakerDiarization = settings?.speakerDiarization ?? (sttProvider === 'elevenlabs');
      const sttModel = settings?.sttModel || (sttProvider === 'groq' ? 'whisper-large-v3-turbo' : 'scribe_v2');
      const refineModel = settings?.refineModel || 'openai/gpt-oss-120b';

      // Step 2: Transcribe
      setStatus('transcribing');
      setProgress('음성을 텍스트로 변환 중...');
      await showNotification('전사 시작', '음성을 텍스트로 변환합니다...');

      console.log('[Workflow] Calling transcription with:', { audioPath, language: language.split('-')[0], provider: sttProvider, model: sttModel });
      
      const transcriptionResult = await window.electronAPI.invoke(
        IPC_CHANNELS.TRANSCRIPTION.START,
        { 
          audioPath, 
          language: language.split('-')[0], // 'ko-KR' -> 'ko'
          provider: sttProvider,
          model: sttModel,
          diarize: speakerDiarization,
        }
      );

      console.log('[Workflow] Transcription result:', transcriptionResult);

      if (!transcriptionResult.success || !transcriptionResult.data?.text) {
        throw new Error(transcriptionResult.error || '변환에 실패했습니다');
      }

      const originalText = transcriptionResult.data.text;
      const segments = transcriptionResult.data.segments as TranscriptionSegment[] | undefined;
      console.log('[Workflow] Original text:', originalText.substring(0, 100));
      console.log('[Workflow] Segments:', segments?.length || 0, 'segments found');
      if (segments && segments.length > 0) {
        const speakerSegments = segments.filter(s => s.speaker);
        console.log('[Workflow] Speaker segments:', speakerSegments.length, 'of', segments.length);
        if (speakerSegments.length > 0) {
          console.log('[Workflow] First speaker segment:', JSON.stringify(speakerSegments[0]));
        }
      }
      
      // 화자 분리 데이터 저장
      if (segments && segments.length > 0) {
        setCurrentSegments(segments);
      } else {
        setCurrentSegments(null);
      }

      // 전사 완료 즉시 원문 복사 + 붙여넣기 (사용자가 바로 사용 가능)
      if (settings?.autoCopyOnComplete) {
        try {
          await window.electronAPI.invoke('system:clipboard-copy', originalText);
          options.onAutoCopy?.(originalText);
          console.log('[Workflow] Auto-copied original text to clipboard immediately after transcription');
          // 즉시 자동 붙여넣기 (Cmd+V 시뮬레이션)
          await window.electronAPI.invoke('system:auto-paste');
          console.log('[Workflow] Auto-paste simulated with original text');
          await showNotification('전사 완료', '원문이 붙여넣기 되었습니다. 정제 진행 중...');
        } catch (copyErr) {
          console.error('Immediate auto copy/paste failed:', copyErr);
          await showNotification('전사 완료', '텍스트 변환 완료. 정제 진행 중...');
        }
      } else {
        await showNotification('전사 완료', '텍스트 변환 완료. 정제 진행 중...');
      }

      // Step 3: Refine (백그라운드에서 진행)
      setStatus('refining');
      setProgress('텍스트를 정제하고 요약 중...');

      console.log('[Workflow] Calling refinement with:', { text: originalText.substring(0, 50), formatType, refineModel });
      
      const refinementResult = await window.electronAPI.invoke(
        IPC_CHANNELS.REFINEMENT.START,
        { 
          text: originalText, 
          formatType,
          language: language.split('-')[0],
          refineModel,
        }
      );

      console.log('[Workflow] Refinement result:', refinementResult);

      if (!refinementResult.success || !refinementResult.data) {
        throw new Error(refinementResult.error || '정제에 실패했습니다');
      }

      const refinedText = refinementResult.data.text;
      const formalText = refinementResult.data.formalText;
      const summary = refinementResult.data.summary;
      console.log('[Workflow] Refined:', { refinedText: refinedText?.substring(0, 50), formalText: formalText?.substring(0, 50), summary });
      
      // 정제 완료 알림
      await showNotification('정제 완료', '텍스트 정제 및 요약이 완료되었습니다');

      // 정제/요약 텍스트 별도 저장 (탭별로 다른 내용 표시용)
      setCurrentRefinedText(refinedText || null);
      setCurrentFormalText(formalText || null);

      // Step 4: Create session
      setStatus('saving');
      setProgress('세션을 저장 중...');

      console.log('[Workflow] Creating session with:', { userId: user.id, originalText: originalText?.substring(0, 50), summary });
      
      const newSession = await createSession({
        userId: user.id,
        originalText,
        refinedText: formalText || refinedText, // Use formalText if available
        summary,
        audioPath,
        language: language.split('-')[0],
        formatType: formatType as FormatType,
      });

      console.log('[Workflow] Created session:', newSession);

      if (!newSession) {
        throw new Error('세션 저장에 실패했습니다');
      }

      // 정제 완료 후 정제된 텍스트를 클립보드에 복사 (붙여넣기는 하지 않음 - 이미 원문이 붙여넣기 됨)
      let textToCopy = refinedText; // 기본값: 정제 텍스트
      if (formatType === 'SCRIPT') {
        textToCopy = formalText || refinedText;
      }
      // 정제 텍스트를 클립보드에 복사 (사용자가 필요시 붙여넣을 수 있도록)
      if (textToCopy) {
        try {
          await window.electronAPI.invoke('system:clipboard-copy', textToCopy);
          console.log('[Workflow] Refined text copied to clipboard (format:', formatType, ')');
          // 붙여넣기는 하지 않음 - 원문이 이미 붙여넣기 됨
        } catch (copyErr) {
          console.error('Refined text copy failed:', copyErr);
        }
      }

      // Complete
      setCurrentSession(newSession);
      setStatus('complete');
      setProgress('완료!');
      
      // 완료 알림 - 정제 완료 알림
      await showNotification('정제 완료', '정제된 텍스트가 클립보드에 복사되었습니다');
      
      // suppress 해제만 하고 창은 표시하지 않음 (알림으로 충분)
      try {
        if (window.electronAPI) {
          await window.electronAPI.invoke('window:set-suppress', false);
          // 창 표시 안 함 - 알림으로 완료 확인 가능
        }
        console.log('[Workflow] Workflow complete (window not shown)');
      } catch (showErr) {
        console.error('Failed to release suppress:', showErr);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '워크플로우 실패';
      setError(errorMessage);
      setStatus('error');
      setProgress('');
      console.error('Workflow error:', err);
    }
  }, [user, stopRecording, createSession, settings, options]);

  const startWorkflow = useCallback(async () => {
    setError(null);
    setCurrentSession(null);
    setCurrentSegments(null);
    setCurrentRefinedText(null);
    setCurrentFormalText(null);
    setProgress('녹음을 시작합니다...');
    setStatus('recording');

    try {
      // 녹음 시작 시 창 표시 억제
      if (window.electronAPI) {
        await window.electronAPI.invoke('window:set-suppress', true);
      }
      await startRecording();
      // 녹음 시작 알림
      await showNotification('녹음 시작', '음성 녹음이 시작되었습니다');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '녹음 시작 실패';
      setError(errorMessage);
      setStatus('error');
      setProgress('');
      // 에러 시 suppress 해제
      if (window.electronAPI) {
        await window.electronAPI.invoke('window:set-suppress', false);
      }
    }
  }, [startRecording]);

  const stopWorkflow = useCallback(async () => {
    await stopWorkflowInternal();
  }, [stopWorkflowInternal]);

  const cancelWorkflowFn = useCallback(() => {
    if (isRecording) {
      cancelRecording();
    }
    setStatus('idle');
    setError(null);
    setProgress('');
    setCurrentSession(null);
    setCurrentSegments(null);
    setCurrentRefinedText(null);
    setCurrentFormalText(null);
    if (window.electronAPI) {
      window.electronAPI.invoke('window:set-suppress', false);
    }
  }, [isRecording, cancelRecording]);

  return {
    status,
    startWorkflow,
    stopWorkflow,
    cancelWorkflow: cancelWorkflowFn,
    currentSession,
    currentSegments,
    currentRefinedText,
    currentFormalText,
    error,
    progress,
    // Recording state
    isRecording,
    duration,
    audioLevel,
    mode,
    maxDuration: recordingMaxDuration,
    isWarning,
    // Push-to-Talk handlers
    handleKeyDown,
    handleKeyUp,
  };
}

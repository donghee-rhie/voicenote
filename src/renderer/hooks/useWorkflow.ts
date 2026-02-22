import { useState, useCallback, useEffect, useRef } from 'react';
import { useRecording, RecordingMode, UseRecordingOptions } from './useRecording';
import { useSession } from './useSession';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { IPC_CHANNELS, TranscriptionSegment } from '@common/types/ipc';
import type { ProcessingProgress, WorkflowMode, LLMProvider } from '@common/types/ipc';
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
  | 'translating'
  | 'generating-minutes'
  | 'saving'
  | 'complete'
  | 'error';

interface UseWorkflowOptions extends UseRecordingOptions {
  onAutoCopy?: (text: string) => void;
}

interface UseWorkflowResult {
  status: WorkflowStatus;
  startWorkflow: (mode?: WorkflowMode) => Promise<void>;
  stopWorkflow: () => Promise<void>;
  cancelWorkflow: () => void;
  processAudioFile: (audioPath: string, durationSec: number) => Promise<void>;
  currentSession: Session | null;
  currentSegments: TranscriptionSegment[] | null;
  currentRefinedText: string | null;
  currentFormalText: string | null;
  error: string | null;
  progress: string;
  processingProgress: ProcessingProgress | null;
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
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);

  // Store recording duration for passing to transcription
  const recordingDurationRef = useRef<number>(0);
  // Store current workflow mode
  const workflowModeRef = useRef<WorkflowMode>('normal');

  // Listen for chunk progress events from main process
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubTranscription = window.electronAPI.on(
      IPC_CHANNELS.TRANSCRIPTION.CHUNK_PROGRESS,
      (data: ProcessingProgress) => {
        setProcessingProgress(data);
        setProgress(data.stageLabel);
      }
    );

    const unsubRefinement = window.electronAPI.on(
      IPC_CHANNELS.REFINEMENT.REFINEMENT_PROGRESS,
      (data: ProcessingProgress) => {
        setProcessingProgress(data);
        setProgress(data.stageLabel);
      }
    );

    const unsubTranslation = window.electronAPI.on(
      IPC_CHANNELS.TRANSLATION.PROGRESS,
      (data: ProcessingProgress) => {
        setProcessingProgress(data);
        setProgress(data.stageLabel);
      }
    );

    const unsubMinutes = window.electronAPI.on(
      IPC_CHANNELS.MINUTES.PROGRESS,
      (data: ProcessingProgress) => {
        setProcessingProgress(data);
        setProgress(data.stageLabel);
      }
    );

    return () => {
      unsubTranscription?.();
      unsubRefinement?.();
      unsubTranslation?.();
      unsubMinutes?.();
    };
  }, []);

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
      setProcessingProgress(null);
      // Capture duration before stopping
      recordingDurationRef.current = duration;
      const audioPath = await stopRecording();
      
      // 녹음 종료 알림
      await showNotification('녹음 종료', '전사 및 정제 처리 중...');

      if (!audioPath) {
        throw new Error('오디오 파일 경로를 찾을 수 없습니다');
      }

      // Get settings values with defaults
      const sttProvider = settings?.preferredSTTProvider || 'groq';
      const llmProvider: LLMProvider = (settings?.preferredLLMProvider || 'groq') as LLMProvider;
      const language = settings?.preferredLanguage || 'ko-KR';
      const formatType = settings?.pasteFormat || 'FORMATTED';
      // ElevenLabs scribe_v2는 화자 분리 기본 활성화
      const speakerDiarization = settings?.speakerDiarization ?? (sttProvider === 'elevenlabs');
      const defaultLlmModels: Record<LLMProvider, string> = {
        groq: 'openai/gpt-oss-120b',
        fireworks: 'accounts/fireworks/models/gpt-oss-120b',
        openai: 'gpt-4o',
        anthropic: 'claude-sonnet-4-6',
      };
      const getDefaultLlmModel = (provider: string) => defaultLlmModels[provider as LLMProvider] || 'openai/gpt-oss-120b';
      const fixModelForProvider = (model: string, provider: string): string => {
        if (provider === 'fireworks' && !model.startsWith('accounts/fireworks/')) return getDefaultLlmModel('fireworks');
        if (provider !== 'fireworks' && model.startsWith('accounts/fireworks/')) return getDefaultLlmModel(provider);
        return model;
      };
      let refineModel = fixModelForProvider(settings?.refineModel || getDefaultLlmModel(llmProvider), llmProvider);

      // Ensure STT model is valid for the selected provider
      const groqModels = ['whisper-large-v3', 'whisper-large-v3-turbo', 'distil-whisper-large-v3-en'];
      const elevenlabsModels = ['scribe_v1', 'scribe_v2'];
      const fireworksModels = ['whisper-v3', 'whisper-v3-turbo'];
      let sttModel: string;
      if (sttProvider === 'elevenlabs') {
        sttModel = (settings?.sttModel && elevenlabsModels.includes(settings.sttModel)) ? settings.sttModel : 'scribe_v2';
      } else if (sttProvider === 'fireworks') {
        sttModel = (settings?.sttModel && fireworksModels.includes(settings.sttModel)) ? settings.sttModel : 'whisper-v3-turbo';
      } else {
        sttModel = (settings?.sttModel && groqModels.includes(settings.sttModel)) ? settings.sttModel : 'whisper-large-v3-turbo';
      }

      // Step 2: Transcribe
      setStatus('transcribing');
      setProgress('음성을 텍스트로 변환 중...');
      await showNotification('전사 시작', '음성을 텍스트로 변환합니다...');

      console.log('[Workflow] Calling transcription with:', { audioPath, language: language.split('-')[0], provider: sttProvider, model: sttModel, diarize: speakerDiarization, settingsProvider: settings?.preferredSTTProvider, settingsModel: settings?.sttModel });
      
      const transcriptionResult = await window.electronAPI.invoke(
        IPC_CHANNELS.TRANSCRIPTION.START,
        {
          audioPath,
          language: language.split('-')[0], // 'ko-KR' -> 'ko'
          provider: sttProvider,
          model: sttModel,
          diarize: speakerDiarization,
          recordingDuration: recordingDurationRef.current,
        }
      );

      console.log('[Workflow] Transcription result:', JSON.stringify(transcriptionResult, null, 2));

      if (!transcriptionResult.success) {
        throw new Error(transcriptionResult.error || '전사 요청이 실패했습니다');
      }

      if (!transcriptionResult.data?.text) {
        console.error('[Workflow] Transcription data:', transcriptionResult.data);
        throw new Error('전사 결과가 비어있습니다. 녹음 내용을 확인해주세요.');
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

      // Branch based on workflow mode
      const currentMode = workflowModeRef.current;
      console.log('[Workflow] Current mode:', currentMode);

      if (currentMode === 'translate') {
        // === TRANSLATION MODE ===
        setStatus('translating');
        setProgress('번역 중...');
        await showNotification('전사 완료', '번역을 시작합니다...');

        const targetLanguage = settings?.translationTargetLanguage || 'en';
        const translationProvider = (settings?.translationLLMProvider || llmProvider) as LLMProvider;
        // 모델 결정: 명시 설정 > 동일 프로바이더면 refineModel > 프로바이더 기본값
        let translationModel: string;
        if (settings?.translationModel) {
          translationModel = fixModelForProvider(settings.translationModel, translationProvider);
        } else if (translationProvider === llmProvider) {
          translationModel = refineModel;
        } else {
          translationModel = getDefaultLlmModel(translationProvider);
        }

        console.log('[Workflow] Calling translation with:', { targetLanguage, model: translationModel, llmProvider: translationProvider, translationLLMProviderSetting: settings?.translationLLMProvider, translationModelSetting: settings?.translationModel });

        const translationResult = await window.electronAPI.invoke(
          IPC_CHANNELS.TRANSLATION.START,
          {
            text: originalText,
            targetLanguage,
            model: translationModel,
            llmProvider: translationProvider,
          }
        );

        if (!translationResult.success || !translationResult.data) {
          throw new Error(translationResult.error || `번역 실패 (provider=${translationProvider}, model=${translationModel})`);
        }

        const translatedText = translationResult.data.text;
        console.log('[Workflow] Translation complete:', translatedText?.substring(0, 100));

        setCurrentRefinedText(translatedText || null);
        setCurrentFormalText(null);

        // Auto-paste translated text
        try {
          await window.electronAPI.invoke('system:clipboard-copy', translatedText);
          await window.electronAPI.invoke('system:auto-paste');
          await showNotification('번역 완료', '번역된 텍스트가 붙여넣기 되었습니다');
        } catch (pasteErr) {
          console.error('Translation auto-paste failed:', pasteErr);
          await showNotification('번역 완료', '번역이 완료되었습니다. 클립보드에 복사됨');
        }

        // Save session
        setStatus('saving');
        setProgress('세션을 저장 중...');

        const newSession = await createSession({
          userId: user.id,
          originalText,
          refinedText: translatedText,
          summary: `[번역: ${targetLanguage}] ${originalText.substring(0, 100)}...`,
          audioPath,
          language: language.split('-')[0],
          provider: sttProvider,
          model: sttModel,
          llmProvider: translationProvider,
          llmModel: translationModel,
          formatType: formatType as FormatType,
        });

        if (!newSession) throw new Error('세션 저장에 실패했습니다');

        setCurrentSession(newSession);
        setStatus('complete');
        setProgress('완료!');
        setProcessingProgress(null);

      } else if (currentMode === 'minutes') {
        // === MINUTES (구조화 정리) MODE ===
        setStatus('generating-minutes');
        setProgress('내용 구조화 중...');
        await showNotification('전사 완료', '내용을 구조화하여 정리합니다...');

        const minutesProvider = (settings?.minutesLLMProvider || llmProvider) as LLMProvider;
        // 모델 결정: 명시 설정 > 동일 프로바이더면 refineModel > 프로바이더 기본값
        let minutesModel: string;
        if (settings?.minutesModel) {
          minutesModel = fixModelForProvider(settings.minutesModel, minutesProvider);
        } else if (minutesProvider === llmProvider) {
          minutesModel = refineModel;
        } else {
          minutesModel = getDefaultLlmModel(minutesProvider);
        }

        console.log('[Workflow] Calling structured notes generation with:', { model: minutesModel, llmProvider: minutesProvider, minutesLLMProviderSetting: settings?.minutesLLMProvider, minutesModelSetting: settings?.minutesModel });

        const minutesResult = await window.electronAPI.invoke(
          IPC_CHANNELS.MINUTES.START,
          {
            text: originalText,
            language: language.split('-')[0],
            model: minutesModel,
            llmProvider: minutesProvider,
          }
        );

        if (!minutesResult.success || !minutesResult.data) {
          throw new Error(minutesResult.error || `구조화 정리 실패 (provider=${minutesProvider}, model=${minutesModel})`);
        }

        const minutesText = minutesResult.data.text;
        console.log('[Workflow] Structured notes complete:', minutesText?.substring(0, 100));

        setCurrentRefinedText(minutesText || null);
        setCurrentFormalText(null);

        // Auto-paste minutes text
        try {
          await window.electronAPI.invoke('system:clipboard-copy', minutesText);
          await window.electronAPI.invoke('system:auto-paste');
          await showNotification('정리 완료', '구조화된 텍스트가 붙여넣기 되었습니다');
        } catch (pasteErr) {
          console.error('Minutes auto-paste failed:', pasteErr);
          await showNotification('정리 완료', '구조화 정리가 완료되었습니다. 클립보드에 복사됨');
        }

        // Save session
        setStatus('saving');
        setProgress('세션을 저장 중...');

        const newSession = await createSession({
          userId: user.id,
          originalText,
          refinedText: minutesText,
          summary: `[구조화 정리] ${originalText.substring(0, 100)}...`,
          audioPath,
          language: language.split('-')[0],
          provider: sttProvider,
          model: sttModel,
          llmProvider: minutesProvider,
          llmModel: minutesModel,
          formatType: formatType as FormatType,
        });

        if (!newSession) throw new Error('세션 저장에 실패했습니다');

        setCurrentSession(newSession);
        setStatus('complete');
        setProgress('완료!');
        setProcessingProgress(null);

      } else {
        // === NORMAL MODE (기존 동작) ===
        // 전사 완료 즉시 원문 복사 + 붙여넣기 (사용자가 바로 사용 가능)
        if (settings?.autoCopyOnComplete) {
          try {
            await window.electronAPI.invoke('system:clipboard-copy', originalText);
            options.onAutoCopy?.(originalText);
            console.log('[Workflow] Auto-copied original text to clipboard immediately after transcription');
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

        // Step 3: Refine
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
            llmProvider,
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

        await showNotification('정제 완료', '텍스트 정제 및 요약이 완료되었습니다');

        setCurrentRefinedText(refinedText || null);
        setCurrentFormalText(formalText || null);

        // Step 4: Create session
        setStatus('saving');
        setProgress('세션을 저장 중...');

        const newSession = await createSession({
          userId: user.id,
          originalText,
          refinedText: formalText || refinedText,
          summary,
          audioPath,
          language: language.split('-')[0],
          provider: sttProvider,
          model: sttModel,
          llmProvider,
          llmModel: refineModel,
          formatType: formatType as FormatType,
        });

        if (!newSession) throw new Error('세션 저장에 실패했습니다');

        setCurrentSession(newSession);
        setStatus('complete');
        setProgress('완료!');
        setProcessingProgress(null);

        await showNotification('정제 완료', '텍스트 정제 및 요약이 완료되었습니다');
      }

      // suppress 해제만 하고 창은 표시하지 않음 (알림으로 충분)
      try {
        if (window.electronAPI) {
          await window.electronAPI.invoke('window:set-suppress', false);
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
      setProcessingProgress(null);
      console.error('Workflow error:', err);
    }
  }, [user, stopRecording, createSession, settings, options, duration]);

  const startWorkflow = useCallback(async (mode: WorkflowMode = 'normal') => {
    workflowModeRef.current = mode;
    setError(null);
    setCurrentSession(null);
    setCurrentSegments(null);
    setCurrentRefinedText(null);
    setCurrentFormalText(null);
    setProcessingProgress(null);

    const modeLabels: Record<WorkflowMode, string> = {
      normal: '녹음을 시작합니다...',
      translate: '번역 모드 녹음을 시작합니다...',
      minutes: '구조화 정리 모드 녹음을 시작합니다...',
    };
    const modeNotifications: Record<WorkflowMode, string> = {
      normal: '음성 녹음이 시작되었습니다',
      translate: '번역 모드 녹음이 시작되었습니다',
      minutes: '구조화 정리 모드 녹음이 시작되었습니다',
    };

    setProgress(modeLabels[mode]);
    setStatus('recording');

    try {
      if (window.electronAPI) {
        await window.electronAPI.invoke('window:set-suppress', true);
      }
      await startRecording();
      await showNotification('녹음 시작', modeNotifications[mode]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '녹음 시작 실패';
      setError(errorMessage);
      setStatus('error');
      setProgress('');
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
    setProcessingProgress(null);
    setCurrentSession(null);
    setCurrentSegments(null);
    setCurrentRefinedText(null);
    setCurrentFormalText(null);
    if (window.electronAPI) {
      window.electronAPI.invoke('window:set-suppress', false);
    }
  }, [isRecording, cancelRecording]);

  // Process an uploaded audio file through the full workflow (transcribe → refine → save)
  const processAudioFile = useCallback(async (audioPath: string, durationSec: number) => {
    if (!user) {
      setError('사용자 정보를 찾을 수 없습니다');
      setStatus('error');
      return;
    }

    setError(null);
    setCurrentSession(null);
    setCurrentSegments(null);
    setCurrentRefinedText(null);
    setCurrentFormalText(null);
    setProcessingProgress(null);

    try {
      const sttProvider = settings?.preferredSTTProvider || 'groq';
      const llmProvider: LLMProvider = (settings?.preferredLLMProvider || 'groq') as LLMProvider;
      const language = settings?.preferredLanguage || 'ko-KR';
      const formatType = settings?.pasteFormat || 'FORMATTED';
      const speakerDiarization = settings?.speakerDiarization ?? (sttProvider === 'elevenlabs');
      const defaultLlmModels: Record<LLMProvider, string> = {
        groq: 'openai/gpt-oss-120b',
        fireworks: 'accounts/fireworks/models/gpt-oss-120b',
        openai: 'gpt-4o',
        anthropic: 'claude-sonnet-4-6',
      };
      const getDefaultLlmModel = (provider: string) => defaultLlmModels[provider as LLMProvider] || 'openai/gpt-oss-120b';
      const fixModelForProvider = (model: string, provider: string): string => {
        if (provider === 'fireworks' && !model.startsWith('accounts/fireworks/')) return getDefaultLlmModel('fireworks');
        if (provider !== 'fireworks' && model.startsWith('accounts/fireworks/')) return getDefaultLlmModel(provider);
        return model;
      };
      let refineModel = fixModelForProvider(settings?.refineModel || getDefaultLlmModel(llmProvider), llmProvider);

      // Ensure STT model is valid for the selected provider
      const groqModels = ['whisper-large-v3', 'whisper-large-v3-turbo', 'distil-whisper-large-v3-en'];
      const elevenlabsModels = ['scribe_v1', 'scribe_v2'];
      const fireworksModels = ['whisper-v3', 'whisper-v3-turbo'];
      let sttModel: string;
      if (sttProvider === 'elevenlabs') {
        sttModel = (settings?.sttModel && elevenlabsModels.includes(settings.sttModel)) ? settings.sttModel : 'scribe_v2';
      } else if (sttProvider === 'fireworks') {
        sttModel = (settings?.sttModel && fireworksModels.includes(settings.sttModel)) ? settings.sttModel : 'whisper-v3-turbo';
      } else {
        sttModel = (settings?.sttModel && groqModels.includes(settings.sttModel)) ? settings.sttModel : 'whisper-large-v3-turbo';
      }

      // Step 1: Transcribe
      setStatus('transcribing');
      setProgress('음성을 텍스트로 변환 중...');

      console.log('[Workflow] Processing uploaded file:', { audioPath, durationSec, provider: sttProvider, model: sttModel, diarize: speakerDiarization, llmProvider });

      const transcriptionResult = await window.electronAPI.invoke(
        IPC_CHANNELS.TRANSCRIPTION.START,
        {
          audioPath,
          language: language.split('-')[0],
          provider: sttProvider,
          model: sttModel,
          diarize: speakerDiarization,
          recordingDuration: durationSec,
        }
      );

      if (!transcriptionResult.success) {
        throw new Error(transcriptionResult.error || '전사 요청이 실패했습니다');
      }

      if (!transcriptionResult.data?.text) {
        throw new Error('전사 결과가 비어있습니다.');
      }

      const originalText = transcriptionResult.data.text;
      const segments = transcriptionResult.data.segments as TranscriptionSegment[] | undefined;
      console.log('[Workflow] Transcription complete:', originalText.substring(0, 100));

      if (segments && segments.length > 0) {
        setCurrentSegments(segments);
      }

      // Step 2: Refine
      setStatus('refining');
      setProgress('텍스트를 정제하고 요약 중...');

      const refinementResult = await window.electronAPI.invoke(
        IPC_CHANNELS.REFINEMENT.START,
        {
          text: originalText,
          formatType,
          language: language.split('-')[0],
          refineModel,
          llmProvider,
        }
      );

      if (!refinementResult.success || !refinementResult.data) {
        throw new Error(refinementResult.error || '정제에 실패했습니다');
      }

      const refinedText = refinementResult.data.text;
      const formalText = refinementResult.data.formalText;
      const summary = refinementResult.data.summary;

      setCurrentRefinedText(refinedText || null);
      setCurrentFormalText(formalText || null);

      // Step 3: Create session
      setStatus('saving');
      setProgress('세션을 저장 중...');

      const newSession = await createSession({
        userId: user.id,
        originalText,
        refinedText: formalText || refinedText,
        summary,
        audioPath,
        language: language.split('-')[0],
        provider: sttProvider,
        model: sttModel,
        llmProvider,
        llmModel: refineModel,
        formatType: formatType as FormatType,
      });

      if (!newSession) {
        throw new Error('세션 저장에 실패했습니다');
      }

      setCurrentSession(newSession);
      setStatus('complete');
      setProgress('완료!');
      setProcessingProgress(null);

      await showNotification('파일 처리 완료', '전사 및 정제가 완료되었습니다');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '파일 처리 실패';
      setError(errorMessage);
      setStatus('error');
      setProgress('');
      setProcessingProgress(null);
      console.error('[Workflow] processAudioFile error:', err);
    }
  }, [user, createSession, settings]);

  return {
    status,
    startWorkflow,
    stopWorkflow,
    cancelWorkflow: cancelWorkflowFn,
    processAudioFile,
    currentSession,
    currentSegments,
    currentRefinedText,
    currentFormalText,
    error,
    progress,
    processingProgress,
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

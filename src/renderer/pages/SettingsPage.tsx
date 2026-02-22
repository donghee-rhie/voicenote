import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../components/ui/use-toast';
import { Badge } from '../components/ui/badge';
import { User, Mic, FileText, Settings, Keyboard, Key, Eye, EyeOff, Check, X, Loader2, Palette } from 'lucide-react';
import { ThemeSelector } from '../components/ThemeSelector';
import { IPC_CHANNELS } from '@common/types/ipc';
import type { ApiKeyType, LLMProvider } from '@common/types/ipc';

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const shortcuts = [
  {
    keys: isMac ? ['⌘', 'Shift', 'R'] : ['Ctrl', 'Shift', 'R'],
    description: '녹음 토글',
  },
  {
    keys: isMac ? ['⌘', 'Shift', 'T'] : ['Ctrl', 'Shift', 'T'],
    description: '번역 모드 녹음',
  },
  {
    keys: isMac ? ['⌘', 'Shift', 'M'] : ['Ctrl', 'Shift', 'M'],
    description: '구조화 정리 모드 녹음',
  },
  {
    keys: isMac ? ['⌘', 'Shift', 'C'] : ['Ctrl', 'Shift', 'C'],
    description: '텍스트 복사',
  },
  {
    keys: ['Esc'],
    description: '취소',
  },
  {
    keys: ['?'],
    description: '도움말',
  },
];

export function SettingsPage() {
  const { user } = useAuth();
  const { settings, loading, updateSettings } = useSettings();
  const { toast } = useToast();

  // Local state for form values
  const [preferredSTTProvider, setPreferredSTTProvider] = useState<'groq' | 'elevenlabs' | 'fireworks'>('groq');
  const [preferredLanguage, setPreferredLanguage] = useState('ko-KR');
  const [speakerDiarization, setSpeakerDiarization] = useState(false);
  const [pasteFormat, setPasteFormat] = useState<'DEFAULT' | 'FORMATTED' | 'SCRIPT' | 'AUTO'>('DEFAULT');
  const [autoFormatDetection, setAutoFormatDetection] = useState(true);
  const [listDetection, setListDetection] = useState(true);
  const [markdownOutput, setMarkdownOutput] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  const [autoSaveInterval, setAutoSaveInterval] = useState(30);
  const [autoStart, setAutoStart] = useState(false);
  const [autoStartLoading, setAutoStartLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // API Key states
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqKeyMasked, setGroqKeyMasked] = useState<string | null>(null);
  const [groqKeyExists, setGroqKeyExists] = useState(false);
  const [groqKeySaving, setGroqKeySaving] = useState(false);
  const [groqKeyValidation, setGroqKeyValidation] = useState<{ valid: boolean; message: string } | null>(null);
  const [showGroqKey, setShowGroqKey] = useState(false);

  const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
  const [elevenlabsKeyMasked, setElevenlabsKeyMasked] = useState<string | null>(null);
  const [elevenlabsKeyExists, setElevenlabsKeyExists] = useState(false);
  const [elevenlabsKeySaving, setElevenlabsKeySaving] = useState(false);
  const [elevenlabsKeyValidation, setElevenlabsKeyValidation] = useState<{ valid: boolean; message: string } | null>(null);
  const [showElevenlabsKey, setShowElevenlabsKey] = useState(false);

  const [fireworksApiKey, setFireworksApiKey] = useState('');
  const [fireworksKeyMasked, setFireworksKeyMasked] = useState<string | null>(null);
  const [fireworksKeyExists, setFireworksKeyExists] = useState(false);
  const [fireworksKeySaving, setFireworksKeySaving] = useState(false);
  const [fireworksKeyValidation, setFireworksKeyValidation] = useState<{ valid: boolean; message: string } | null>(null);
  const [showFireworksKey, setShowFireworksKey] = useState(false);

  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiKeyMasked, setOpenaiKeyMasked] = useState<string | null>(null);
  const [openaiKeyExists, setOpenaiKeyExists] = useState(false);
  const [openaiKeySaving, setOpenaiKeySaving] = useState(false);
  const [openaiKeyValidation, setOpenaiKeyValidation] = useState<{ valid: boolean; message: string } | null>(null);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [anthropicKeyMasked, setAnthropicKeyMasked] = useState<string | null>(null);
  const [anthropicKeyExists, setAnthropicKeyExists] = useState(false);
  const [anthropicKeySaving, setAnthropicKeySaving] = useState(false);
  const [anthropicKeyValidation, setAnthropicKeyValidation] = useState<{ valid: boolean; message: string } | null>(null);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  // Model selection states
  const [sttModel, setSttModel] = useState('whisper-large-v3-turbo');
  const [refineModel, setRefineModel] = useState('openai/gpt-oss-120b');
  const [preferredLLMProvider, setPreferredLLMProvider] = useState<LLMProvider>('groq');
  
  // Recording settings
  const [maxRecordingDuration, setMaxRecordingDuration] = useState(300); // seconds
  const [autoCopyOnComplete, setAutoCopyOnComplete] = useState(true); // 기본 활성화

  // Translation & Minutes settings
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState('en');
  const [translationLLMProvider, setTranslationLLMProvider] = useState<LLMProvider>('groq');
  const [translationModel, setTranslationModel] = useState('');
  const [minutesLLMProvider, setMinutesLLMProvider] = useState<LLMProvider>('groq');
  const [minutesModel, setMinutesModel] = useState('');

  // STT Models by provider
  const groqSttModels = [
    { id: 'whisper-large-v3-turbo', name: 'Whisper Large v3 Turbo', description: '빠르고 정확 (권장)' },
    { id: 'whisper-large-v3', name: 'Whisper Large v3', description: '최고 품질' },
    { id: 'distil-whisper-large-v3-en', name: 'Distil Whisper (영어)', description: '영어 전용' },
  ];

  const elevenlabsSttModels = [
    { id: 'scribe_v2', name: 'Scribe v2', description: '화자 분리 지원 (권장)' },
    { id: 'scribe_v1', name: 'Scribe v1', description: '기본 모델' },
  ];

  const fireworksSttModels = [
    { id: 'whisper-v3-turbo', name: 'Whisper v3 Turbo', description: '빠르고 정확 (권장)' },
    { id: 'whisper-v3', name: 'Whisper v3', description: '최고 품질' },
  ];

  // Groq LLM models (https://groq.com/pricing)
  const llmModels = [
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', description: '128k 컨텍스트 (권장)' },
    { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', description: '128k 컨텍스트, 경량 (빠름)' },
    { id: 'openai/gpt-oss-safeguard-20b', name: 'GPT-OSS Safeguard 20B', description: '128k 컨텍스트, 안전 강화' },
    { id: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2 Instruct', description: '256k 컨텍스트, 고성능' },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', description: '128k 컨텍스트, 경량 MoE' },
    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B', description: '128k 컨텍스트, 대규모 MoE' },
    { id: 'qwen/qwen3-32b', name: 'Qwen3 32B', description: '131k 컨텍스트' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: '128k 컨텍스트, 범용' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: '128k 컨텍스트, 초고속' },
  ];

  // Fireworks LLM models - serverless only (https://docs.fireworks.ai/guides/recommended-models)
  const fireworksLlmModels = [
    { id: 'accounts/fireworks/models/gpt-oss-120b', name: 'GPT-OSS 120B', description: '128k 컨텍스트, 고성능 (권장)' },
    { id: 'accounts/fireworks/models/gpt-oss-20b', name: 'GPT-OSS 20B', description: '128k 컨텍스트, 경량 (빠름)' },
    { id: 'accounts/fireworks/models/deepseek-v3p2', name: 'DeepSeek V3.2', description: '최신 추론 모델' },
    { id: 'accounts/fireworks/models/glm-4p7', name: 'GLM-4.7', description: '고성능 대규모 모델' },
    { id: 'accounts/fireworks/models/kimi-k2p5', name: 'Kimi K2.5', description: '멀티모달, 고성능' },
    { id: 'accounts/fireworks/models/qwen2p5-72b-instruct', name: 'Qwen 2.5 72B', description: '범용 Instruct' },
    { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', name: 'Llama 3.3 70B', description: '강력한 범용' },
    { id: 'accounts/fireworks/models/qwen3-8b', name: 'Qwen3 8B', description: '경량 고성능' },
    { id: 'accounts/fireworks/models/llama-v3p1-8b-instruct', name: 'Llama 3.1 8B', description: '경량 (초고속)' },
  ];

  const openaiLlmModels = [
    { id: 'gpt-4o', name: 'GPT-4o', description: '멀티모달 모델 (권장)' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '경량, 빠른 응답' },
    { id: 'gpt-5', name: 'GPT-5', description: '최신 플래그십 모델' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: '최신 경량 고성능' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano', description: '최신 초경량' },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: '코딩/지시 특화' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: '경량 고성능' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: '초경량, 최저 비용' },
    { id: 'o3', name: 'o3', description: '추론 모델' },
    { id: 'o3-mini', name: 'o3 Mini', description: '경량 추론 모델' },
    { id: 'o4-mini', name: 'o4 Mini', description: '최신 경량 추론' },
  ];

  const anthropicLlmModels = [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: '최신 최고 성능 (권장)' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: '최신 빠른 고성능' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: '빠르고 경제적' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: '균형 잡힌 성능' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: '고성능 모델' },
    { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', description: '고급 추론' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: '안정적 성능' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: '안정적 고성능' },
  ];

  const currentSttModels = preferredSTTProvider === 'groq'
    ? groqSttModels
    : preferredSTTProvider === 'elevenlabs'
      ? elevenlabsSttModels
      : fireworksSttModels;

  const getLlmModelsForProvider = (provider: LLMProvider) => {
    switch (provider) {
      case 'fireworks': return fireworksLlmModels;
      case 'openai': return openaiLlmModels;
      case 'anthropic': return anthropicLlmModels;
      default: return llmModels;
    }
  };
  const currentLlmModels = getLlmModelsForProvider(preferredLLMProvider);

  // Initialize form values from settings
  useEffect(() => {
    if (settings) {
      setPreferredSTTProvider(settings.preferredSTTProvider);
      setPreferredLanguage(settings.preferredLanguage);
      setSpeakerDiarization(settings.speakerDiarization);
      setPasteFormat(settings.pasteFormat);
      setAutoFormatDetection(settings.autoFormatDetection);
      setListDetection(settings.listDetection);
      setMarkdownOutput(settings.markdownOutput);
      setViewMode(settings.viewMode);
      setAutoSaveInterval(Math.floor(settings.autoSaveInterval / 1000)); // Convert ms to seconds
      // Model settings
      if (settings.sttModel) setSttModel(settings.sttModel);
      if (settings.refineModel) setRefineModel(settings.refineModel);
      // Recording settings
      if (settings.maxRecordingDuration) setMaxRecordingDuration(settings.maxRecordingDuration);
      if (settings.autoCopyOnComplete !== undefined) setAutoCopyOnComplete(settings.autoCopyOnComplete);
      if (settings.preferredLLMProvider) setPreferredLLMProvider(settings.preferredLLMProvider as LLMProvider);
      // Translation & Minutes settings
      if (settings.translationTargetLanguage) setTranslationTargetLanguage(settings.translationTargetLanguage);
      // 빈 문자열이면 preferredLLMProvider를 사용 (최초 마이그레이션 후 빈값 대응)
      const effectiveTranslationProvider = (settings.translationLLMProvider || settings.preferredLLMProvider || 'groq') as LLMProvider;
      setTranslationLLMProvider(effectiveTranslationProvider);
      if (settings.translationModel !== undefined) setTranslationModel(settings.translationModel || '');
      const effectiveMinutesProvider = (settings.minutesLLMProvider || settings.preferredLLMProvider || 'groq') as LLMProvider;
      setMinutesLLMProvider(effectiveMinutesProvider);
      if (settings.minutesModel !== undefined) setMinutesModel(settings.minutesModel || '');
    }
  }, [settings]);

  // Load auto-start setting
  useEffect(() => {
    const loadAutoStart = async () => {
      try {
        const result = await window.electronAPI.invoke('system:auto-start-get');
        if (result.success) {
          setAutoStart(result.data);
        }
      } catch (error) {
        console.error('Failed to load auto-start setting:', error);
      }
    };
    loadAutoStart();
  }, []);

  // Load API keys status
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        // Load Groq API key status
        const groqResult = await window.electronAPI.invoke(IPC_CHANNELS.API_KEY.GET, 'groq');
        if (groqResult.success && groqResult.data) {
          setGroqKeyExists(groqResult.data.exists);
          setGroqKeyMasked(groqResult.data.masked);
        }

        // Load ElevenLabs API key status
        const elevenlabsResult = await window.electronAPI.invoke(IPC_CHANNELS.API_KEY.GET, 'elevenlabs');
        if (elevenlabsResult.success && elevenlabsResult.data) {
          setElevenlabsKeyExists(elevenlabsResult.data.exists);
          setElevenlabsKeyMasked(elevenlabsResult.data.masked);
        }

        // Load Fireworks API key status
        const fireworksResult = await window.electronAPI.invoke(IPC_CHANNELS.API_KEY.GET, 'fireworks');
        if (fireworksResult.success && fireworksResult.data) {
          setFireworksKeyExists(fireworksResult.data.exists);
          setFireworksKeyMasked(fireworksResult.data.masked);
        }

        // Load OpenAI API key status
        const openaiResult = await window.electronAPI.invoke(IPC_CHANNELS.API_KEY.GET, 'openai');
        if (openaiResult.success && openaiResult.data) {
          setOpenaiKeyExists(openaiResult.data.exists);
          setOpenaiKeyMasked(openaiResult.data.masked);
        }

        // Load Anthropic API key status
        const anthropicResult = await window.electronAPI.invoke(IPC_CHANNELS.API_KEY.GET, 'anthropic');
        if (anthropicResult.success && anthropicResult.data) {
          setAnthropicKeyExists(anthropicResult.data.exists);
          setAnthropicKeyMasked(anthropicResult.data.masked);
        }
      } catch (error) {
        console.error('Failed to load API keys:', error);
      }
    };
    loadApiKeys();
  }, []);

  // Validate and save API key
  const handleSaveApiKey = async (type: ApiKeyType, key: string) => {
    const stateMap: Record<ApiKeyType, any> = {
      groq: { setSaving: setGroqKeySaving, setValidation: setGroqKeyValidation, setKeyExists: setGroqKeyExists, setKeyMasked: setGroqKeyMasked, setKey: setGroqApiKey },
      elevenlabs: { setSaving: setElevenlabsKeySaving, setValidation: setElevenlabsKeyValidation, setKeyExists: setElevenlabsKeyExists, setKeyMasked: setElevenlabsKeyMasked, setKey: setElevenlabsApiKey },
      fireworks: { setSaving: setFireworksKeySaving, setValidation: setFireworksKeyValidation, setKeyExists: setFireworksKeyExists, setKeyMasked: setFireworksKeyMasked, setKey: setFireworksApiKey },
      openai: { setSaving: setOpenaiKeySaving, setValidation: setOpenaiKeyValidation, setKeyExists: setOpenaiKeyExists, setKeyMasked: setOpenaiKeyMasked, setKey: setOpenaiApiKey },
      anthropic: { setSaving: setAnthropicKeySaving, setValidation: setAnthropicKeyValidation, setKeyExists: setAnthropicKeyExists, setKeyMasked: setAnthropicKeyMasked, setKey: setAnthropicApiKey },
    };
    const { setSaving, setValidation, setKeyExists, setKeyMasked, setKey } = stateMap[type];
    const providerNames: Record<ApiKeyType, string> = { groq: 'Groq', elevenlabs: 'ElevenLabs', fireworks: 'Fireworks', openai: 'OpenAI', anthropic: 'Anthropic' };

    if (!key.trim()) {
      setValidation({ valid: false, message: 'API 키를 입력해주세요' });
      return;
    }

    setSaving(true);
    setValidation(null);

    try {
      // Validate first
      const validateResult = await window.electronAPI.invoke(IPC_CHANNELS.API_KEY.VALIDATE, type, key);
      if (validateResult.success && validateResult.data) {
        if (!validateResult.data.valid) {
          setValidation({ valid: false, message: validateResult.data.message });
          setSaving(false);
          return;
        }
      }

      // Save the key
      const saveResult = await window.electronAPI.invoke(IPC_CHANNELS.API_KEY.SET, type, key);
      if (saveResult.success && saveResult.data) {
        setKeyExists(saveResult.data.exists);
        setKeyMasked(saveResult.data.masked);
        setKey('');
        setValidation({ valid: true, message: 'API 키가 저장되었습니다' });
        toast({
          title: 'API 키 저장 완료',
          description: `${providerNames[type]} API 키가 저장되었습니다.`,
        });
      } else {
        throw new Error(saveResult.error || 'API 키 저장 실패');
      }
    } catch (error) {
      setValidation({
        valid: false,
        message: error instanceof Error ? error.message : 'API 키 저장 실패',
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete API key
  const handleDeleteApiKey = async (type: ApiKeyType) => {
    const stateMap: Record<ApiKeyType, any> = {
      groq: { setKeyExists: setGroqKeyExists, setKeyMasked: setGroqKeyMasked, setValidation: setGroqKeyValidation },
      elevenlabs: { setKeyExists: setElevenlabsKeyExists, setKeyMasked: setElevenlabsKeyMasked, setValidation: setElevenlabsKeyValidation },
      fireworks: { setKeyExists: setFireworksKeyExists, setKeyMasked: setFireworksKeyMasked, setValidation: setFireworksKeyValidation },
      openai: { setKeyExists: setOpenaiKeyExists, setKeyMasked: setOpenaiKeyMasked, setValidation: setOpenaiKeyValidation },
      anthropic: { setKeyExists: setAnthropicKeyExists, setKeyMasked: setAnthropicKeyMasked, setValidation: setAnthropicKeyValidation },
    };
    const { setKeyExists, setKeyMasked, setValidation } = stateMap[type];
    const providerNames: Record<ApiKeyType, string> = { groq: 'Groq', elevenlabs: 'ElevenLabs', fireworks: 'Fireworks', openai: 'OpenAI', anthropic: 'Anthropic' };

    try {
      const result = await window.electronAPI.invoke(IPC_CHANNELS.API_KEY.DELETE, type);
      if (result.success) {
        setKeyExists(false);
        setKeyMasked(null);
        setValidation(null);
        toast({
          title: 'API 키 삭제 완료',
          description: `${providerNames[type]} API 키가 삭제되었습니다.`,
        });
      } else {
        throw new Error(result.error || 'API 키 삭제 실패');
      }
    } catch (error) {
      toast({
        title: 'API 키 삭제 실패',
        description: error instanceof Error ? error.message : 'API 키 삭제 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        preferredSTTProvider,
        preferredLanguage,
        speakerDiarization,
        pasteFormat,
        autoFormatDetection,
        listDetection,
        markdownOutput,
        viewMode,
        autoSaveInterval: autoSaveInterval * 1000, // Convert seconds to ms
        sttModel,
        refineModel,
        maxRecordingDuration,
        autoCopyOnComplete,
        preferredLLMProvider,
        translationTargetLanguage,
        translationLLMProvider,
        translationModel,
        minutesLLMProvider,
        minutesModel,
      });

      toast({
        title: '설정 저장 완료',
        description: '변경사항이 성공적으로 저장되었습니다.',
      });
    } catch (error) {
      toast({
        title: '설정 저장 실패',
        description: error instanceof Error ? error.message : '설정 저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoStartToggle = async (checked: boolean) => {
    setAutoStartLoading(true);
    try {
      const result = await window.electronAPI.invoke('system:auto-start-set', checked);
      if (result.success) {
        setAutoStart(checked);
        toast({
          title: '자동 실행 설정 변경',
          description: checked ? '시스템 시작 시 자동으로 실행됩니다.' : '자동 실행이 비활성화되었습니다.',
        });
      } else {
        throw new Error(result.error || '설정 변경 실패');
      }
    } catch (error) {
      toast({
        title: '설정 변경 실패',
        description: error instanceof Error ? error.message : '자동 실행 설정 변경 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setAutoStartLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">설정 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">설정</h2>
        <p className="text-muted-foreground">애플리케이션 설정을 관리하세요</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            프로필
          </CardTitle>
          <CardDescription>사용자 정보</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input value={user?.name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>이메일</Label>
              <Input value={user?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>역할</Label>
              <div className="flex items-center h-10">
                <Badge variant={user?.role === 'ADMIN' ? 'default' : 'secondary'}>
                  {user?.role === 'ADMIN' ? '관리자' : '사용자'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Key Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API 키 관리
          </CardTitle>
          <CardDescription>STT 및 LLM 서비스 연동을 위한 API 키를 설정하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Groq API Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="groq-api-key" className="text-base font-medium">Groq API 키</Label>
                <p className="text-sm text-muted-foreground">
                  Groq Whisper STT 및 LLM Refinement에 사용됩니다
                </p>
              </div>
              {groqKeyExists && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  설정됨
                </Badge>
              )}
            </div>
            
            {groqKeyExists && groqKeyMasked && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <code className="text-sm font-mono">{groqKeyMasked}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteApiKey('groq')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="groq-api-key"
                  type={showGroqKey ? 'text' : 'password'}
                  placeholder="gsk_..."
                  value={groqApiKey}
                  onChange={(e) => {
                    setGroqApiKey(e.target.value);
                    setGroqKeyValidation(null);
                  }}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowGroqKey(!showGroqKey)}
                >
                  {showGroqKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                onClick={() => handleSaveApiKey('groq', groqApiKey)}
                disabled={groqKeySaving || !groqApiKey.trim()}
              >
                {groqKeySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
              </Button>
            </div>

            {groqKeyValidation && (
              <p className={`text-sm ${groqKeyValidation.valid ? 'text-green-600' : 'text-destructive'}`}>
                {groqKeyValidation.message}
              </p>
            )}
          </div>

          <Separator />

          {/* ElevenLabs API Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="elevenlabs-api-key" className="text-base font-medium">ElevenLabs API 키</Label>
                <p className="text-sm text-muted-foreground">
                  ElevenLabs Scribe STT 및 화자분리에 사용됩니다
                </p>
              </div>
              {elevenlabsKeyExists && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  설정됨
                </Badge>
              )}
            </div>

            {elevenlabsKeyExists && elevenlabsKeyMasked && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <code className="text-sm font-mono">{elevenlabsKeyMasked}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteApiKey('elevenlabs')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="elevenlabs-api-key"
                  type={showElevenlabsKey ? 'text' : 'password'}
                  placeholder="API 키 입력..."
                  value={elevenlabsApiKey}
                  onChange={(e) => {
                    setElevenlabsApiKey(e.target.value);
                    setElevenlabsKeyValidation(null);
                  }}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowElevenlabsKey(!showElevenlabsKey)}
                >
                  {showElevenlabsKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                onClick={() => handleSaveApiKey('elevenlabs', elevenlabsApiKey)}
                disabled={elevenlabsKeySaving || !elevenlabsApiKey.trim()}
              >
                {elevenlabsKeySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
              </Button>
            </div>

            {elevenlabsKeyValidation && (
              <p className={`text-sm ${elevenlabsKeyValidation.valid ? 'text-green-600' : 'text-destructive'}`}>
                {elevenlabsKeyValidation.message}
              </p>
            )}
          </div>

          <Separator />

          {/* Fireworks API Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="fireworks-api-key" className="text-base font-medium">Fireworks API 키</Label>
                <p className="text-sm text-muted-foreground">
                  Fireworks Whisper STT 및 LLM Refinement에 사용됩니다
                </p>
              </div>
              {fireworksKeyExists && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  설정됨
                </Badge>
              )}
            </div>

            {fireworksKeyExists && fireworksKeyMasked && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <code className="text-sm font-mono">{fireworksKeyMasked}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteApiKey('fireworks')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="fireworks-api-key"
                  type={showFireworksKey ? 'text' : 'password'}
                  placeholder="API 키 입력..."
                  value={fireworksApiKey}
                  onChange={(e) => {
                    setFireworksApiKey(e.target.value);
                    setFireworksKeyValidation(null);
                  }}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowFireworksKey(!showFireworksKey)}
                >
                  {showFireworksKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                onClick={() => handleSaveApiKey('fireworks', fireworksApiKey)}
                disabled={fireworksKeySaving || !fireworksApiKey.trim()}
              >
                {fireworksKeySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
              </Button>
            </div>

            {fireworksKeyValidation && (
              <p className={`text-sm ${fireworksKeyValidation.valid ? 'text-green-600' : 'text-destructive'}`}>
                {fireworksKeyValidation.message}
              </p>
            )}
          </div>

          <Separator />

          {/* OpenAI API Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="openai-api-key" className="text-base font-medium">OpenAI API 키</Label>
                <p className="text-sm text-muted-foreground">
                  OpenAI GPT 모델 LLM Refinement에 사용됩니다
                </p>
              </div>
              {openaiKeyExists && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  설정됨
                </Badge>
              )}
            </div>

            {openaiKeyExists && openaiKeyMasked && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <code className="text-sm font-mono">{openaiKeyMasked}</code>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteApiKey('openai')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="openai-api-key"
                  type={showOpenaiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={openaiApiKey}
                  onChange={(e) => { setOpenaiApiKey(e.target.value); setOpenaiKeyValidation(null); }}
                  className="pr-10"
                />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowOpenaiKey(!showOpenaiKey)}>
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button onClick={() => handleSaveApiKey('openai', openaiApiKey)} disabled={openaiKeySaving || !openaiApiKey.trim()}>
                {openaiKeySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
              </Button>
            </div>

            {openaiKeyValidation && (
              <p className={`text-sm ${openaiKeyValidation.valid ? 'text-green-600' : 'text-destructive'}`}>
                {openaiKeyValidation.message}
              </p>
            )}
          </div>

          <Separator />

          {/* Anthropic API Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="anthropic-api-key" className="text-base font-medium">Anthropic API 키</Label>
                <p className="text-sm text-muted-foreground">
                  Anthropic Claude 모델 LLM Refinement에 사용됩니다
                </p>
              </div>
              {anthropicKeyExists && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  설정됨
                </Badge>
              )}
            </div>

            {anthropicKeyExists && anthropicKeyMasked && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <code className="text-sm font-mono">{anthropicKeyMasked}</code>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteApiKey('anthropic')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="anthropic-api-key"
                  type={showAnthropicKey ? 'text' : 'password'}
                  placeholder="sk-ant-..."
                  value={anthropicApiKey}
                  onChange={(e) => { setAnthropicApiKey(e.target.value); setAnthropicKeyValidation(null); }}
                  className="pr-10"
                />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowAnthropicKey(!showAnthropicKey)}>
                  {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button onClick={() => handleSaveApiKey('anthropic', anthropicApiKey)} disabled={anthropicKeySaving || !anthropicApiKey.trim()}>
                {anthropicKeySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
              </Button>
            </div>

            {anthropicKeyValidation && (
              <p className={`text-sm ${anthropicKeyValidation.valid ? 'text-green-600' : 'text-destructive'}`}>
                {anthropicKeyValidation.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Voice Conversion Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            음성 변환 설정
          </CardTitle>
          <CardDescription>STT 및 음성 처리 옵션</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="stt-provider">STT 제공자 선택</Label>
            <Select value={preferredSTTProvider} onValueChange={(value) => {
              setPreferredSTTProvider(value as 'groq' | 'elevenlabs' | 'fireworks');
              // Reset model to first option when provider changes
              if (value === 'groq') {
                setSttModel('whisper-large-v3-turbo');
              } else if (value === 'elevenlabs') {
                setSttModel('scribe_v2');
                // ElevenLabs scribe_v2 선택 시 화자 분리 자동 활성화
                setSpeakerDiarization(true);
              } else if (value === 'fireworks') {
                setSttModel('whisper-v3-turbo');
              }
            }}>
              <SelectTrigger id="stt-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="groq">Groq Whisper</SelectItem>
                <SelectItem value="elevenlabs">ElevenLabs Scribe</SelectItem>
                <SelectItem value="fireworks">Fireworks Whisper</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stt-model">STT 모델 선택</Label>
            <Select value={sttModel} onValueChange={setSttModel}>
              <SelectTrigger id="stt-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentSttModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span>{model.name}</span>
                      <span className="text-xs text-muted-foreground">{model.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="llm-provider">LLM 제공자 선택</Label>
            <Select value={preferredLLMProvider} onValueChange={(value) => {
              const provider = value as LLMProvider;
              setPreferredLLMProvider(provider);
              const defaults: Record<LLMProvider, string> = {
                groq: 'openai/gpt-oss-120b',
                fireworks: 'accounts/fireworks/models/gpt-oss-120b',
                openai: 'gpt-4o',
                anthropic: 'claude-sonnet-4-6',
              };
              setRefineModel(defaults[provider]);
            }}>
              <SelectTrigger id="llm-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="groq">Groq</SelectItem>
                <SelectItem value="fireworks">Fireworks</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic Claude</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refine-model">텍스트 정제 모델</Label>
            <Select value={refineModel} onValueChange={setRefineModel}>
              <SelectTrigger id="refine-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentLlmModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span>{model.name}</span>
                      <span className="text-xs text-muted-foreground">{model.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="language">기본 언어</Label>
            <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ko-KR">한국어 (ko-KR)</SelectItem>
                <SelectItem value="en-US">English (en-US)</SelectItem>
                <SelectItem value="ja-JP">日本語 (ja-JP)</SelectItem>
                <SelectItem value="zh-CN">中文 (zh-CN)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="speaker-diarization">화자 분리</Label>
              <p className="text-sm text-muted-foreground">
                여러 화자를 자동으로 구분합니다
              </p>
            </div>
            <Switch
              id="speaker-diarization"
              checked={speakerDiarization}
              onCheckedChange={setSpeakerDiarization}
            />
          </div>
        </CardContent>
      </Card>

      {/* Text Refinement Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            텍스트 정제 설정
          </CardTitle>
          <CardDescription>텍스트 출력 포맷 및 처리 옵션</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="paste-format">기본 포맷</Label>
            <Select value={pasteFormat} onValueChange={(value) => setPasteFormat(value as 'DEFAULT' | 'FORMATTED' | 'SCRIPT' | 'AUTO')}>
              <SelectTrigger id="paste-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEFAULT">기본 (원본)</SelectItem>
                <SelectItem value="FORMATTED">정제된 텍스트</SelectItem>
                <SelectItem value="SCRIPT">스크립트 형식</SelectItem>
                <SelectItem value="AUTO">자동 감지</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-format">자동 포맷 감지</Label>
              <p className="text-sm text-muted-foreground">
                텍스트 내용에 따라 자동으로 포맷을 선택합니다
              </p>
            </div>
            <Switch
              id="auto-format"
              checked={autoFormatDetection}
              onCheckedChange={setAutoFormatDetection}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="list-detection">목록 감지</Label>
              <p className="text-sm text-muted-foreground">
                리스트 형식의 텍스트를 자동으로 감지합니다
              </p>
            </div>
            <Switch
              id="list-detection"
              checked={listDetection}
              onCheckedChange={setListDetection}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="markdown">마크다운 출력</Label>
              <p className="text-sm text-muted-foreground">
                마크다운 형식으로 텍스트를 출력합니다
              </p>
            </div>
            <Switch
              id="markdown"
              checked={markdownOutput}
              onCheckedChange={setMarkdownOutput}
            />
          </div>
        </CardContent>
      </Card>

      {/* Translation & Minutes Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            번역 및 구조화 정리 설정
          </CardTitle>
          <CardDescription>번역 모드({isMac ? '⌘' : 'Ctrl'}+Shift+T) 및 구조화 정리 모드({isMac ? '⌘' : 'Ctrl'}+Shift+M) 옵션</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Translation settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">번역 설정</h4>

            <div className="space-y-2">
              <Label htmlFor="translation-target-language">번역 타겟 언어</Label>
              <Select value={translationTargetLanguage} onValueChange={setTranslationTargetLanguage}>
                <SelectTrigger id="translation-target-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ko">한국어</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="translation-llm-provider">번역 LLM 제공자</Label>
              <Select value={translationLLMProvider} onValueChange={(value) => {
                const provider = value as LLMProvider;
                setTranslationLLMProvider(provider);
                const defaults: Record<LLMProvider, string> = {
                  groq: 'openai/gpt-oss-120b',
                  fireworks: 'accounts/fireworks/models/gpt-oss-120b',
                  openai: 'gpt-4o',
                  anthropic: 'claude-sonnet-4-6',
                };
                setTranslationModel(defaults[provider]);
              }}>
                <SelectTrigger id="translation-llm-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="fireworks">Fireworks</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="translation-model">번역 모델</Label>
              <Select value={translationModel || '_default'} onValueChange={(v) => setTranslationModel(v === '_default' ? '' : v)}>
                <SelectTrigger id="translation-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_default">정제 모델과 동일</SelectItem>
                  {getLlmModelsForProvider(translationLLMProvider).map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground">{model.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                미설정 시 텍스트 정제 모델과 동일한 모델을 사용합니다
              </p>
            </div>
          </div>

          <Separator />

          {/* Minutes (structured notes) settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">구조화 정리 설정</h4>

            <div className="space-y-2">
              <Label htmlFor="minutes-llm-provider">구조화 정리 LLM 제공자</Label>
              <Select value={minutesLLMProvider} onValueChange={(value) => {
                const provider = value as LLMProvider;
                setMinutesLLMProvider(provider);
                const defaults: Record<LLMProvider, string> = {
                  groq: 'openai/gpt-oss-120b',
                  fireworks: 'accounts/fireworks/models/gpt-oss-120b',
                  openai: 'gpt-4o',
                  anthropic: 'claude-sonnet-4-6',
                };
                setMinutesModel(defaults[provider]);
              }}>
                <SelectTrigger id="minutes-llm-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="fireworks">Fireworks</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minutes-model">구조화 정리 모델</Label>
              <Select value={minutesModel || '_default'} onValueChange={(v) => setMinutesModel(v === '_default' ? '' : v)}>
                <SelectTrigger id="minutes-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_default">정제 모델과 동일</SelectItem>
                  {getLlmModelsForProvider(minutesLLMProvider).map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground">{model.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                미설정 시 텍스트 정제 모델과 동일한 모델을 사용합니다
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            테마 설정
          </CardTitle>
          <CardDescription>앱의 외관을 변경하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>

      {/* App Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            앱 설정
          </CardTitle>
          <CardDescription>애플리케이션 동작 설정</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="view-mode">보기 모드</Label>
            <Select value={viewMode} onValueChange={(value) => setViewMode(value as 'timeline' | 'list')}>
              <SelectTrigger id="view-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timeline">타임라인</SelectItem>
                <SelectItem value="list">리스트</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-save-interval">자동 저장 간격 (초)</Label>
            <Input
              id="auto-save-interval"
              type="number"
              min="10"
              max="300"
              value={autoSaveInterval}
              onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              10초에서 300초 사이의 값을 입력하세요
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="max-recording-duration">최대 녹음 시간 (초)</Label>
            <Input
              id="max-recording-duration"
              type="number"
              min="60"
              max="7200"
              value={maxRecordingDuration}
              onChange={(e) => setMaxRecordingDuration(Number(e.target.value))}
            />
            <p className="text-sm text-muted-foreground">
              60초(1분)에서 7,200초(120분) 사이의 값을 입력하세요. 종료 60초 전에 경고가 표시됩니다.
              {maxRecordingDuration > 600 && (
                <span className="block mt-1 text-amber-600">
                  장시간 녹음은 청크 분할 전사로 처리됩니다.
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-copy">완료 시 자동 복사</Label>
              <p className="text-sm text-muted-foreground">
                녹음 완료 후 정제된 텍스트를 자동으로 클립보드에 복사합니다
              </p>
            </div>
            <Switch
              id="auto-copy"
              checked={autoCopyOnComplete}
              onCheckedChange={setAutoCopyOnComplete}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-start">시스템 시작 시 자동 실행</Label>
              <p className="text-sm text-muted-foreground">
                컴퓨터를 시작할 때 자동으로 앱을 실행합니다
              </p>
            </div>
            <Switch
              id="auto-start"
              checked={autoStart}
              onCheckedChange={handleAutoStartToggle}
              disabled={autoStartLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            키보드 단축키
          </CardTitle>
          <CardDescription>자주 사용하는 기능의 단축키</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4 py-2"
              >
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, keyIndex) => (
                    <React.Fragment key={keyIndex}>
                      {keyIndex > 0 && (
                        <span className="text-muted-foreground">+</span>
                      )}
                      <kbd className="pointer-events-none inline-flex h-7 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-sm font-medium text-muted-foreground">
                        {key}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {shortcut.description}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} disabled={isSaving || loading}>
          {isSaving ? '저장 중...' : '설정 저장'}
        </Button>
      </div>
    </div>
  );
}

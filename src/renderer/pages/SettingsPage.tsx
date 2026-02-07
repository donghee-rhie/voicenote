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
import type { ApiKeyType } from '@common/types/ipc';

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const shortcuts = [
  {
    keys: isMac ? ['⌘', 'Shift', 'R'] : ['Ctrl', 'Shift', 'R'],
    description: '녹음 토글',
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
  const [preferredSTTProvider, setPreferredSTTProvider] = useState<'groq' | 'elevenlabs'>('groq');
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

  // Model selection states
  const [sttModel, setSttModel] = useState('whisper-large-v3-turbo');
  const [refineModel, setRefineModel] = useState('openai/gpt-oss-120b');
  
  // Recording settings
  const [maxRecordingDuration, setMaxRecordingDuration] = useState(300); // seconds
  const [autoCopyOnComplete, setAutoCopyOnComplete] = useState(true); // 기본 활성화

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

  const llmModels = [
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', description: 'OpenAI 호환 최대 모델 (권장)' },
    { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', description: 'OpenAI 호환 경량 모델 (빠름)' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: '가장 강력' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: '빠른 응답' },
    { id: 'llama3-70b-8192', name: 'Llama 3 70B', description: '높은 품질' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: '긴 컨텍스트' },
  ];

  const currentSttModels = preferredSTTProvider === 'groq' ? groqSttModels : elevenlabsSttModels;

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
      } catch (error) {
        console.error('Failed to load API keys:', error);
      }
    };
    loadApiKeys();
  }, []);

  // Validate and save API key
  const handleSaveApiKey = async (type: ApiKeyType, key: string) => {
    const setSaving = type === 'groq' ? setGroqKeySaving : setElevenlabsKeySaving;
    const setValidation = type === 'groq' ? setGroqKeyValidation : setElevenlabsKeyValidation;
    const setKeyExists = type === 'groq' ? setGroqKeyExists : setElevenlabsKeyExists;
    const setKeyMasked = type === 'groq' ? setGroqKeyMasked : setElevenlabsKeyMasked;
    const setKey = type === 'groq' ? setGroqApiKey : setElevenlabsApiKey;

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
          description: `${type === 'groq' ? 'Groq' : 'ElevenLabs'} API 키가 저장되었습니다.`,
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
    const setKeyExists = type === 'groq' ? setGroqKeyExists : setElevenlabsKeyExists;
    const setKeyMasked = type === 'groq' ? setGroqKeyMasked : setElevenlabsKeyMasked;
    const setValidation = type === 'groq' ? setGroqKeyValidation : setElevenlabsKeyValidation;

    try {
      const result = await window.electronAPI.invoke(IPC_CHANNELS.API_KEY.DELETE, type);
      if (result.success) {
        setKeyExists(false);
        setKeyMasked(null);
        setValidation(null);
        toast({
          title: 'API 키 삭제 완료',
          description: `${type === 'groq' ? 'Groq' : 'ElevenLabs'} API 키가 삭제되었습니다.`,
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
              setPreferredSTTProvider(value as 'groq' | 'elevenlabs');
              // Reset model to first option when provider changes
              if (value === 'groq') {
                setSttModel('whisper-large-v3-turbo');
              } else {
                setSttModel('scribe_v2');
                // ElevenLabs scribe_v2 선택 시 화자 분리 자동 활성화
                setSpeakerDiarization(true);
              }
            }}>
              <SelectTrigger id="stt-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="groq">Groq Whisper</SelectItem>
                <SelectItem value="elevenlabs">ElevenLabs Scribe</SelectItem>
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
            <Label htmlFor="refine-model">텍스트 정제 모델</Label>
            <Select value={refineModel} onValueChange={setRefineModel}>
              <SelectTrigger id="refine-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {llmModels.map((model) => (
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

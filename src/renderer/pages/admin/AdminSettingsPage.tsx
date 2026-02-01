import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, Mic, FileText, Zap, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Skeleton } from '../../components/ui/skeleton';
import { Separator } from '../../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../components/ui/use-toast';
import { SystemSetting, SystemSettingType } from '@common/types';

// STT Provider and Model definitions
const STT_PROVIDERS = [
  {
    id: 'groq',
    name: 'Groq Whisper',
    description: '빠르고 정확한 음성 인식',
    models: [
      { id: 'whisper-large-v3-turbo', name: 'Whisper Large v3 Turbo', description: '빠르고 정확 (권장)', recommended: true },
      { id: 'whisper-large-v3', name: 'Whisper Large v3', description: '최고 품질', recommended: false },
      { id: 'distil-whisper-large-v3-en', name: 'Distil Whisper (영어)', description: '영어 전용', recommended: false },
    ],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs Scribe',
    description: '화자 분리 지원',
    models: [
      { id: 'scribe_v2', name: 'Scribe v2', description: '화자 분리 지원 (권장)', recommended: true },
      { id: 'scribe_v1', name: 'Scribe v1', description: '기본 모델', recommended: false },
    ],
  },
];

const LLM_MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', description: 'OpenAI 호환 최대 모델 (권장)', recommended: true },
  { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', description: 'OpenAI 호환 경량 모델 (빠름)', recommended: false },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', description: '가장 강력한 Llama 모델', recommended: false },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: '빠른 응답', recommended: false },
  { id: 'llama3-70b-8192', name: 'Llama 3 70B', description: '높은 품질', recommended: false },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: '긴 컨텍스트', recommended: false },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', description: '경량 고성능', recommended: false },
];

interface SettingGroup {
  title: string;
  description: string;
  settings: SystemSetting[];
}

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  // Model settings state
  const [sttProvider, setSttProvider] = useState('groq');
  const [sttModel, setSttModel] = useState('whisper-large-v3-turbo');
  const [refineModel, setRefineModel] = useState('openai/gpt-oss-120b');
  const [classifierModel, setClassifierModel] = useState('llama-3.1-8b-instant');
  const [modelSettingsSaving, setModelSettingsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    loadModelSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.invoke('settings:system-get');
      if (result.success && result.data) {
        setSettings(result.data);
      } else {
        toast({
          title: '오류',
          description: result.error || '설정을 불러올 수 없습니다',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '설정을 불러오는 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadModelSettings = async () => {
    try {
      const result = await window.electronAPI.invoke('settings:system-get');
      if (result.success && result.data) {
        const settingsMap = new Map<string, string | undefined>(
          result.data.map((s: SystemSetting) => [s.key, s.value])
        );
        const provider = settingsMap.get('stt_provider');
        const model = settingsMap.get('stt_model');
        const refine = settingsMap.get('refine_model');
        const classifier = settingsMap.get('classifier_model');
        
        if (provider) setSttProvider(provider);
        if (model) setSttModel(model);
        if (refine) setRefineModel(refine);
        if (classifier) setClassifierModel(classifier);
      }
    } catch (error) {
      console.error('Failed to load model settings:', error);
    }
  };

  const handleSaveModelSettings = async () => {
    setModelSettingsSaving(true);
    try {
      // Save all model settings
      const modelSettings = [
        { key: 'stt_provider', value: sttProvider, type: 'string' as SystemSettingType },
        { key: 'stt_model', value: sttModel, type: 'string' as SystemSettingType },
        { key: 'refine_model', value: refineModel, type: 'string' as SystemSettingType },
        { key: 'classifier_model', value: classifierModel, type: 'string' as SystemSettingType },
      ];

      for (const setting of modelSettings) {
        await window.electronAPI.invoke('settings:system-update', setting);
      }

      toast({
        title: '성공',
        description: 'AI 모델 설정이 저장되었습니다',
      });
    } catch (error) {
      toast({
        title: '오류',
        description: '설정 저장 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    } finally {
      setModelSettingsSaving(false);
    }
  };

  const handleSaveSetting = async (setting: SystemSetting) => {
    setSaving(setting.id);
    try {
      const result = await window.electronAPI.invoke('settings:system-update', {
        key: setting.key,
        value: setting.value,
        type: setting.type,
      });

      if (result.success) {
        toast({
          title: '성공',
          description: '설정이 저장되었습니다',
        });
      } else {
        toast({
          title: '오류',
          description: result.error || '설정 저장에 실패했습니다',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '설정 저장 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleValueChange = (id: string, value: string) => {
    setSettings(
      settings.map((setting) =>
        setting.id === id ? { ...setting, value } : setting
      )
    );
  };

  const handleBooleanChange = (id: string, checked: boolean) => {
    setSettings(
      settings.map((setting) =>
        setting.id === id ? { ...setting, value: String(checked) } : setting
      )
    );
  };

  const groupSettings = (settings: SystemSetting[]): SettingGroup[] => {
    const groups: Record<string, SystemSetting[]> = {
      general: [],
      security: [],
      api: [],
      storage: [],
      other: [],
    };

    settings.forEach((setting) => {
      const key = setting.key.toLowerCase();
      if (key.includes('security') || key.includes('password') || key.includes('auth')) {
        groups.security.push(setting);
      } else if (key.includes('api') || key.includes('key')) {
        groups.api.push(setting);
      } else if (key.includes('storage') || key.includes('limit') || key.includes('size')) {
        groups.storage.push(setting);
      } else if (key.includes('app') || key.includes('system')) {
        groups.general.push(setting);
      } else {
        groups.other.push(setting);
      }
    });

    return [
      {
        title: '일반 설정',
        description: '애플리케이션 기본 설정',
        settings: groups.general,
      },
      {
        title: '보안 설정',
        description: '인증 및 보안 관련 설정',
        settings: groups.security,
      },
      {
        title: 'API 설정',
        description: 'API 키 및 외부 서비스 설정',
        settings: groups.api,
      },
      {
        title: '저장소 설정',
        description: '데이터 저장 및 용량 관련 설정',
        settings: groups.storage,
      },
      {
        title: '기타 설정',
        description: '기타 시스템 설정',
        settings: groups.other,
      },
    ].filter((group) => group.settings.length > 0);
  };

  const renderSettingInput = (setting: SystemSetting) => {
    switch (setting.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={setting.id}
              checked={setting.value === 'true'}
              onCheckedChange={(checked) => handleBooleanChange(setting.id, checked)}
            />
            <Label htmlFor={setting.id} className="text-sm text-muted-foreground cursor-pointer">
              {setting.value === 'true' ? '활성화' : '비활성화'}
            </Label>
          </div>
        );
      case 'number':
        return (
          <Input
            id={setting.id}
            type="number"
            value={setting.value || ''}
            onChange={(e) => handleValueChange(setting.id, e.target.value)}
            className="max-w-xs"
          />
        );
      case 'json':
        return (
          <Input
            id={setting.id}
            value={setting.value || ''}
            onChange={(e) => handleValueChange(setting.id, e.target.value)}
            placeholder='{"key": "value"}'
            className="font-mono text-sm"
          />
        );
      default:
        return (
          <Input
            id={setting.id}
            value={setting.value || ''}
            onChange={(e) => handleValueChange(setting.id, e.target.value)}
          />
        );
    }
  };

  const getSettingLabel = (key: string): string => {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const settingGroups = groupSettings(settings);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">시스템 설정</h3>
          <p className="text-sm text-muted-foreground">
            시스템 전역 설정을 관리합니다
          </p>
        </div>
        <Button onClick={loadSettings} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          새로고침
        </Button>
      </div>

      {/* AI Model Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            AI 모델 설정
          </CardTitle>
          <CardDescription>음성 인식 및 텍스트 정제에 사용할 AI 모델을 선택하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* STT Provider */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">음성 인식 (STT) 제공자</Label>
            </div>
            <Select value={sttProvider} onValueChange={(value) => {
              setSttProvider(value);
              // Reset model to recommended when provider changes
              const provider = STT_PROVIDERS.find(p => p.id === value);
              const recommendedModel = provider?.models.find(m => m.recommended);
              if (recommendedModel) setSttModel(recommendedModel.id);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STT_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    <div className="flex items-center gap-2">
                      <span>{provider.name}</span>
                      <span className="text-xs text-muted-foreground">- {provider.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* STT Model */}
          <div className="space-y-3">
            <Label className="text-base font-medium">STT 모델</Label>
            <Select value={sttModel} onValueChange={setSttModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STT_PROVIDERS.find(p => p.id === sttProvider)?.models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      {model.recommended && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          권장
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {STT_PROVIDERS.find(p => p.id === sttProvider)?.models.find(m => m.id === sttModel)?.description}
            </p>
          </div>

          <Separator />

          {/* Refine Model */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">텍스트 정제 모델</Label>
            </div>
            <Select value={refineModel} onValueChange={setRefineModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LLM_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      {model.recommended && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          권장
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {LLM_MODELS.find(m => m.id === refineModel)?.description}
            </p>
          </div>

          {/* Classifier Model */}
          <div className="space-y-3">
            <Label className="text-base font-medium">분류기 모델</Label>
            <Select value={classifierModel} onValueChange={setClassifierModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LLM_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <span>{model.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              항목화 필요 여부를 판단하는 모델 (빠른 모델 권장)
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveModelSettings} disabled={modelSettingsSaving}>
              {modelSettingsSaving ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              모델 설정 저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {settings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">추가 시스템 설정이 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {settingGroups.map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle>{group.title}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {group.settings.map((setting, index) => (
                  <div key={setting.id}>
                    {index > 0 && <Separator className="my-4" />}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label htmlFor={setting.id} className="text-base font-medium">
                              {getSettingLabel(setting.key)}
                            </Label>
                            {setting.description && (
                              <p className="text-sm text-muted-foreground">
                                {setting.description}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSaveSetting(setting)}
                            disabled={saving === setting.id}
                          >
                            {saving === setting.id ? (
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-4 w-4" />
                            )}
                            저장
                          </Button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            {setting.key}
                          </code>
                          <span className="text-xs text-muted-foreground">
                            ({setting.type})
                          </span>
                        </div>
                      </div>
                      {renderSettingInput(setting)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

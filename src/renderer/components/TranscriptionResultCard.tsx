import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Copy, FileText, ListOrdered, Users, Pencil, X, Check, Eye } from 'lucide-react';
import type { Session } from '@common/types/session';

interface Segment {
  id?: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

interface TranscriptionResultCardProps {
  session: Session;
  segments?: Segment[];
  refinedText?: string;  // 정제된 텍스트 (별도 전달)
  formalText?: string;   // 요약 텍스트 (별도 전달)
  onViewSession?: () => void;
  onNewRecording?: () => void;
  className?: string;
}

type ViewMode = 'raw' | 'refined' | 'formal' | 'speakers';

// Speaker colors for differentiation
const SPEAKER_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
];

export function TranscriptionResultCard({
  session,
  segments,
  refinedText: propRefinedText,
  formalText: propFormalText,
  onViewSession,
  onNewRecording,
  className,
}: TranscriptionResultCardProps) {
  const { toast } = useToast();
  
  // 정제/요약 텍스트 (props 우선, 없으면 session에서)
  const refinedText = propRefinedText || session.refinedText || '';
  const formalText = propFormalText || '';
  
  // Check if we have speaker-labeled segments
  const speakerSegments = segments?.filter(seg => seg.speaker) || [];
  const showSpeakersTab = speakerSegments.length > 0;

  // Extract unique speakers from segments
  const uniqueSpeakers = useMemo(() => {
    const speakers = new Set<string>();
    speakerSegments.forEach(seg => {
      if (seg.speaker) speakers.add(seg.speaker);
    });
    return Array.from(speakers);
  }, [speakerSegments]);

  // Speaker name mapping state (original ID -> display name)
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const [isEditingNames, setIsEditingNames] = useState(false);
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});

  // Determine default tab based on available content
  const getDefaultTab = (): ViewMode => {
    if (session.refinedText) return 'refined';
    return 'raw';
  };

  const [activeTab, setActiveTab] = useState<ViewMode>(getDefaultTab());

  // Generate speaker color map
  const speakerColors = useMemo(() => {
    const colors: Record<string, string> = {};
    uniqueSpeakers.forEach((speaker, index) => {
      colors[speaker] = SPEAKER_COLORS[index % SPEAKER_COLORS.length];
    });
    return colors;
  }, [uniqueSpeakers]);

  // Get display name for a speaker
  const getSpeakerDisplayName = (originalSpeaker: string): string => {
    return speakerNames[originalSpeaker] || originalSpeaker;
  };

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format speaker segments as text for copying
  const formatSpeakerText = (): string => {
    if (!speakerSegments.length) return session.originalText || '';

    // Group consecutive segments by speaker
    const grouped: Array<{ speaker: string; texts: string[]; start: number }> = [];
    let currentSpeaker = '';

    for (const seg of speakerSegments) {
      const speaker = seg.speaker || 'Unknown';
      if (speaker !== currentSpeaker) {
        grouped.push({ speaker, texts: [seg.text], start: seg.start });
        currentSpeaker = speaker;
      } else if (grouped.length > 0) {
        grouped[grouped.length - 1].texts.push(seg.text);
      }
    }

    return grouped
      .map(g => `[${formatTimestamp(g.start)}] ${getSpeakerDisplayName(g.speaker)}: ${g.texts.join(' ')}`)
      .join('\n\n');
  };

  const getActiveText = (): string => {
    switch (activeTab) {
      case 'raw':
        return session.originalText || '';
      case 'refined':
        return session.refinedText || session.originalText || '';
      case 'formal':
        return formalText || refinedText || session.originalText || '';
      case 'speakers':
        return formatSpeakerText();
      default:
        return session.refinedText || session.originalText || '';
    }
  };

  const copyToClipboard = async () => {
    const text = getActiveText();
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: '복사됨',
        description: '클립보드에 복사되었습니다',
      });
    } catch {
      toast({
        title: '복사 실패',
        description: '클립보드 복사에 실패했습니다',
        variant: 'destructive',
      });
    }
  };

  // Speaker name editing functions
  const handleStartEditing = () => {
    const initial: Record<string, string> = {};
    uniqueSpeakers.forEach(speaker => {
      initial[speaker] = speakerNames[speaker] || '';
    });
    setEditingNames(initial);
    setIsEditingNames(true);
  };

  const handleSaveNames = () => {
    const filtered: Record<string, string> = {};
    Object.entries(editingNames).forEach(([key, value]) => {
      if (value.trim()) {
        filtered[key] = value.trim();
      }
    });
    setSpeakerNames(filtered);
    setIsEditingNames(false);
    toast({
      title: '저장됨',
      description: '화자 이름이 변경되었습니다',
    });
  };

  const handleCancelEditing = () => {
    setIsEditingNames(false);
    setEditingNames({});
  };

  // Group segments by speaker for display
  const groupedSegments = useMemo(() => {
    const result: Array<{ speaker: string; texts: string[]; start: number }> = [];
    let currentSpeaker = '';

    for (const seg of speakerSegments) {
      const speaker = seg.speaker || 'Unknown';
      if (speaker !== currentSpeaker) {
        result.push({ speaker, texts: [seg.text], start: seg.start });
        currentSpeaker = speaker;
      } else if (result.length > 0) {
        result[result.length - 1].texts.push(seg.text);
      }
    }
    return result;
  }, [speakerSegments]);

  // Calculate grid class for tab layout (Tailwind needs static class names)
  const hasFormalTab = !!(formalText || refinedText);
  const getGridClass = () => {
    const hasSpeakers = showSpeakersTab;
    
    if (hasFormalTab && hasSpeakers) return 'grid-cols-4';
    if (hasFormalTab || hasSpeakers) return 'grid-cols-3';
    return 'grid-cols-2';
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            전사 결과
          </CardTitle>
          <Badge variant="secondary">
            {session.language === 'ko' ? '한국어' : session.language}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* View mode tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ViewMode)}>
          <TabsList className={cn('grid w-full', getGridClass())}>
            <TabsTrigger value="raw" className="flex items-center gap-1 text-xs">
              <FileText className="h-3 w-3" />
              원문
            </TabsTrigger>
            <TabsTrigger 
              value="refined" 
              className="flex items-center gap-1 text-xs"
              disabled={!refinedText}
            >
              <Pencil className="h-3 w-3" />
              정제
            </TabsTrigger>
            {hasFormalTab && (
              <TabsTrigger value="formal" className="flex items-center gap-1 text-xs">
                <ListOrdered className="h-3 w-3" />
                요약
              </TabsTrigger>
            )}
            {showSpeakersTab && (
              <TabsTrigger value="speakers" className="flex items-center gap-1 text-xs">
                <Users className="h-3 w-3" />
                화자분리
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="raw" className="mt-4">
            <TextDisplay text={session.originalText || ''} />
          </TabsContent>
          
          <TabsContent value="refined" className="mt-4">
            <TextDisplay text={refinedText || session.originalText || ''} />
          </TabsContent>
          
          {(formalText || refinedText) && (
            <TabsContent value="formal" className="mt-4">
              <TextDisplay text={formalText || refinedText || ''} />
            </TabsContent>
          )}
          
          {showSpeakersTab && (
            <TabsContent value="speakers" className="mt-4">
              <SpeakerDisplay
                groupedSegments={groupedSegments}
                formatTimestamp={formatTimestamp}
                speakerNames={speakerNames}
                speakerColors={speakerColors}
                getSpeakerDisplayName={getSpeakerDisplayName}
                uniqueSpeakers={uniqueSpeakers}
                isEditingNames={isEditingNames}
                editingNames={editingNames}
                setEditingNames={setEditingNames}
                onStartEditing={handleStartEditing}
                onSaveNames={handleSaveNames}
                onCancelEditing={handleCancelEditing}
              />
            </TabsContent>
          )}
        </Tabs>

        {/* Summary */}
        {session.summary && (
          <div className="p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">요약</span>
            </div>
            <p className="text-sm text-muted-foreground">{session.summary}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 justify-end pt-2 border-t">
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            <Copy className="h-4 w-4 mr-2" />
            복사
          </Button>
          {onNewRecording && (
            <Button variant="outline" size="sm" onClick={onNewRecording}>
              새 녹음
            </Button>
          )}
          {onViewSession && (
            <Button size="sm" onClick={onViewSession}>
              세션 보기
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TextDisplay({ text }: { text: string }) {
  return (
    <div className="p-4 bg-muted/50 rounded-lg min-h-[120px] max-h-[300px] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
      {text || '내용이 없습니다'}
    </div>
  );
}

interface SpeakerDisplayProps {
  groupedSegments: Array<{ speaker: string; texts: string[]; start: number }>;
  formatTimestamp: (seconds: number) => string;
  speakerNames: Record<string, string>;
  speakerColors: Record<string, string>;
  getSpeakerDisplayName: (speaker: string) => string;
  uniqueSpeakers: string[];
  isEditingNames: boolean;
  editingNames: Record<string, string>;
  setEditingNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onStartEditing: () => void;
  onSaveNames: () => void;
  onCancelEditing: () => void;
}

function SpeakerDisplay({
  groupedSegments,
  formatTimestamp,
  speakerNames,
  speakerColors,
  getSpeakerDisplayName,
  uniqueSpeakers,
  isEditingNames,
  editingNames,
  setEditingNames,
  onStartEditing,
  onSaveNames,
  onCancelEditing,
}: SpeakerDisplayProps) {
  return (
    <div className="space-y-3">
      {/* Speaker name editor */}
      <div className="p-3 bg-muted/30 rounded-lg border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">화자 이름 설정</span>
          {!isEditingNames ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onStartEditing}
            >
              <Pencil className="h-3 w-3 mr-1" />
              수정
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onCancelEditing}
              >
                <X className="h-3 w-3 mr-1" />
                취소
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={onSaveNames}
              >
                <Check className="h-3 w-3 mr-1" />
                저장
              </Button>
            </div>
          )}
        </div>

        {isEditingNames ? (
          <div className="grid gap-2">
            {uniqueSpeakers.map((speaker) => (
              <div key={speaker} className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={cn("text-xs shrink-0 w-20 justify-center", speakerColors[speaker])}
                >
                  {speaker}
                </Badge>
                <span className="text-muted-foreground">→</span>
                <Input
                  value={editingNames[speaker] || ''}
                  onChange={(e) =>
                    setEditingNames((prev) => ({
                      ...prev,
                      [speaker]: e.target.value,
                    }))
                  }
                  placeholder="예: 홍길동"
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {uniqueSpeakers.map((speaker) => (
              <div key={speaker} className="flex items-center gap-1">
                <Badge
                  variant="secondary"
                  className={cn("text-xs", speakerColors[speaker])}
                >
                  {getSpeakerDisplayName(speaker)}
                </Badge>
                {speakerNames[speaker] && (
                  <span className="text-xs text-muted-foreground">
                    ({speaker})
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transcript content */}
      <div className="p-4 bg-muted/50 rounded-lg min-h-[120px] max-h-[250px] overflow-y-auto space-y-3">
        {groupedSegments.length === 0 ? (
          <p className="text-sm text-muted-foreground">화자 분리 데이터가 없습니다</p>
        ) : (
          groupedSegments.map((group, index) => (
            <div key={index} className="flex gap-3">
              <div className="flex-shrink-0 text-xs text-muted-foreground pt-1 w-12">
                {formatTimestamp(group.start)}
              </div>
              <div className="flex-1">
                <Badge
                  variant="secondary"
                  className={cn("text-xs mb-1", speakerColors[group.speaker])}
                >
                  {getSpeakerDisplayName(group.speaker)}
                </Badge>
                <p className="text-sm leading-relaxed">
                  {group.texts.join(' ')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

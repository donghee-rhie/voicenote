import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { useSession } from '@/hooks/useSession';
import { useNotification } from '@/hooks/useNotification';
import { Session } from '@common/types/session';
import { IPC_CHANNELS } from '@common/types/ipc';
import {
  ArrowLeft,
  Copy,
  Download,
  Trash2,
  Archive,
  ArchiveRestore,
  Edit2,
  Check,
  X,
  Loader2,
  Clock,
  Languages,
  FileAudio,
  Tag,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getSession, updateSession, deleteSession } = useSession();
  const notification = useNotification();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('original');

  // Audio player state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (id) {
      loadSession();
    }
  }, [id]);

  const loadSession = async () => {
    if (!id) return;

    setLoading(true);
    const sessionData = await getSession(id);
    if (sessionData) {
      setSession(sessionData);
      setEditedTitle(sessionData.title || '');
      setEditedDescription(sessionData.description || '');
      
      // Load audio if available
      if (sessionData.audioPath) {
        loadAudio(sessionData.audioPath);
      }
    } else {
      notification.error('세션 로드 실패', '세션을 찾을 수 없습니다');
      navigate('/sessions');
    }
    setLoading(false);
  };

  const loadAudio = async (audioPath: string) => {
    setAudioLoading(true);
    try {
      const result = await window.electronAPI.invoke(
        IPC_CHANNELS.AUDIO.GET_FILE,
        audioPath
      );

      if (result.success && result.data) {
        const { base64, mimeType } = result.data;
        const url = `data:${mimeType};base64,${base64}`;
        setAudioUrl(url);
      }
    } catch (error) {
      console.error('Failed to load audio:', error);
    } finally {
      setAudioLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveEdit = async () => {
    if (!id || !session) return;

    const updated = await updateSession(id, {
      id,
      title: editedTitle || undefined,
      description: editedDescription || undefined,
    });

    if (updated) {
      setSession(updated);
      setIsEditing(false);
      notification.success('저장 완료', '세션 정보가 업데이트되었습니다');
    } else {
      notification.error('저장 실패', '세션 업데이트에 실패했습니다');
    }
  };

  const handleCancelEdit = () => {
    setEditedTitle(session?.title || '');
    setEditedDescription(session?.description || '');
    setIsEditing(false);
  };

  const handleCopyText = async (text: string, label: string) => {
    try {
      const result = await window.electronAPI.invoke(
        IPC_CHANNELS.SYSTEM.CLIPBOARD_COPY,
        text
      );

      if (result.success) {
        notification.success('복사 완료', `${label}을(를) 클립보드에 복사했습니다`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      notification.error('복사 실패', '클립보드에 복사하는 데 실패했습니다');
    }
  };

  const handleExport = async (format: 'text' | 'markdown' | 'json') => {
    if (!id) return;

    try {
      const result = await window.electronAPI.invoke(
        IPC_CHANNELS.SYSTEM.EXPORT_SESSION,
        { sessionId: id, format }
      );

      if (result.success && !result.canceled) {
        notification.success('내보내기 완료', '세션이 성공적으로 내보내졌습니다');
      } else if (result.canceled) {
        // User canceled the save dialog, no error needed
        return;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      notification.error('내보내기 실패', '세션 내보내기에 실패했습니다');
    }
  };

  const handleArchiveToggle = async () => {
    if (!id || !session) return;

    const newStatus = session.status === 'ARCHIVED' ? 'COMPLETED' : 'ARCHIVED';
    const updated = await updateSession(id, { id, status: newStatus });

    if (updated) {
      setSession(updated);
      notification.success(
        '업데이트 완료',
        newStatus === 'ARCHIVED' ? '세션이 보관되었습니다' : '보관이 해제되었습니다'
      );
    } else {
      notification.error('업데이트 실패', '세션 상태 변경에 실패했습니다');
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    const success = await deleteSession(id);
    if (success) {
      notification.success('삭제 완료', '세션이 삭제되었습니다');
      navigate('/sessions');
    } else {
      notification.error('삭제 실패', '세션 삭제에 실패했습니다');
    }
  };

  const formatDuration = (milliseconds?: number) => {
    if (!milliseconds) return '--:--';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/sessions')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          세션 목록으로
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">세션을 찾을 수 없습니다</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Button variant="ghost" onClick={() => navigate('/sessions')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        세션 목록으로
      </Button>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-4">
              {isEditing ? (
                <div className="space-y-3">
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="제목"
                    className="text-2xl font-bold"
                  />
                  <Textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder="설명 (선택사항)"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Check className="mr-2 h-4 w-4" />
                      저장
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      <X className="mr-2 h-4 w-4" />
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <h2 className="text-2xl font-bold flex-1">
                      {session.title || '제목 없음'}
                    </h2>
                    <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {session.description && (
                    <p className="text-muted-foreground">{session.description}</p>
                  )}
                </>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <StatusBadge status={session.status} />
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(session.duration)}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatDate(session.createdAt)}
                </span>
                {session.language && (
                  <Badge variant="outline">
                    <Languages className="mr-1 h-3 w-3" />
                    {session.language.toUpperCase()}
                  </Badge>
                )}
              </div>

              {session.tags && (
                <div className="flex flex-wrap gap-2">
                  {session.tags.split(',').map((tag, idx) => (
                    <Badge key={idx} variant="secondary">
                      <Tag className="mr-1 h-3 w-3" />
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    내보내기
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('text')}>
                    텍스트 (.txt)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('markdown')}>
                    마크다운 (.md)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('json')}>
                    JSON (.json)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={handleArchiveToggle}>
                {session.status === 'ARCHIVED' ? (
                  <>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    보관 해제
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-4 w-4" />
                    보관
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                삭제
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="original">원본</TabsTrigger>
          <TabsTrigger value="refined">정제</TabsTrigger>
          <TabsTrigger value="summary">요약</TabsTrigger>
        </TabsList>

        <TabsContent value="original" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>원본 텍스트</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyText(session.originalText || '', '원본 텍스트')}
                disabled={!session.originalText}
              >
                <Copy className="mr-2 h-4 w-4" />
                복사
              </Button>
            </CardHeader>
            <CardContent>
              {session.originalText ? (
                <pre className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-lg">
                  {session.originalText}
                </pre>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  원본 텍스트가 없습니다
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refined" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>정제된 텍스트</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyText(session.refinedText || '', '정제된 텍스트')}
                disabled={!session.refinedText}
              >
                <Copy className="mr-2 h-4 w-4" />
                복사
              </Button>
            </CardHeader>
            <CardContent>
              {session.refinedText ? (
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{session.refinedText}</p>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  정제된 텍스트가 없습니다
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>요약</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyText(session.summary || '', '요약')}
                disabled={!session.summary}
              >
                <Copy className="mr-2 h-4 w-4" />
                복사
              </Button>
            </CardHeader>
            <CardContent>
              {session.summary ? (
                <p className="whitespace-pre-wrap">{session.summary}</p>
              ) : (
                <p className="text-muted-foreground text-center py-8">요약이 없습니다</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Audio Player */}
      {session.audioPath && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileAudio className="h-5 w-5" />
              오디오 재생
            </CardTitle>
          </CardHeader>
          <CardContent>
            {audioLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">오디오 로딩 중...</span>
              </div>
            ) : audioUrl ? (
              <div className="space-y-4">
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleAudioEnded}
                  className="hidden"
                />
                
                {/* Player Controls */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePlayPause}
                    className="h-12 w-12 rounded-full"
                  >
                    {isPlaying ? (
                      <Pause className="h-6 w-6" />
                    ) : (
                      <Play className="h-6 w-6 ml-1" />
                    )}
                  </Button>
                  
                  <div className="flex-1 space-y-1">
                    <input
                      type="range"
                      min="0"
                      max={audioDuration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(audioDuration)}</span>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                  >
                    {isMuted ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                오디오 파일을 불러올 수 없습니다
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Panel */}
      <Card>
        <CardHeader>
          <CardTitle>세션 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">파일 경로</p>
              <p className="font-mono text-xs break-all">
                {session.audioPath || '없음'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">언어</p>
              <p>{session.language || '없음'}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">제공자</p>
              <p>{session.provider || '없음'}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">모델</p>
              <p>{session.model || '없음'}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">포맷 타입</p>
              <p>{session.formatType}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">생성일</p>
              <p>{formatDate(session.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">수정일</p>
              <p>{formatDate(session.updatedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">재생 시간</p>
              <p>{formatDuration(session.duration)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="세션 삭제"
        description="이 세션을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
      />
    </div>
  );
}

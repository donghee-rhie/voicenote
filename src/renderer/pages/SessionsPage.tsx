import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useSession } from '@/hooks/useSession';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/hooks/useNotification';
import { Session, SessionStatus } from '@common/types/session';
import { Search, Trash2, Clock, FileAudio, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SessionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sessions, loading, fetchSessions, deleteSession, searchSessions } = useSession();
  const notification = useNotification();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'ALL'>('ALL');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user, statusFilter, page]);

  const loadSessions = async () => {
    if (!user) return;

    await fetchSessions({
      userId: user.id,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (searchQuery.trim()) {
      await searchSessions(searchQuery, user.id);
    } else {
      await loadSessions();
    }
  };

  const handleDeleteClick = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!sessionToDelete) return;

    const success = await deleteSession(sessionToDelete);
    if (success) {
      notification.success('삭제 완료', '세션이 삭제되었습니다');
    } else {
      notification.error('삭제 실패', '세션 삭제에 실패했습니다');
    }

    setDeleteDialogOpen(false);
    setSessionToDelete(null);
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

  const filteredSessions = sessions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">세션</h2>
        <p className="text-muted-foreground">녹음 세션 기록을 확인하세요</p>
      </div>

      {/* Search and Filter */}
      <div className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="세션 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={loading}>
            검색
          </Button>
        </form>

        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as SessionStatus | 'ALL')}>
          <TabsList>
            <TabsTrigger value="ALL">전체</TabsTrigger>
            <TabsTrigger value="DRAFT">초안</TabsTrigger>
            <TabsTrigger value="COMPLETED">완료</TabsTrigger>
            <TabsTrigger value="ARCHIVED">보관</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <EmptyState
          icon={FileAudio}
          title="세션이 없습니다"
          description="녹음을 시작하거나 오디오 파일을 업로드하여 첫 세션을 만들어보세요."
          action={{
            label: '대시보드로 이동',
            onClick: () => navigate('/dashboard'),
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <Card
              key={session.id}
              className="cursor-pointer transition-all hover:shadow-md"
              onClick={() => navigate(`/sessions/${session.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Title and Status */}
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold line-clamp-1">
                        {session.title || '제목 없음'}
                      </h3>
                      <StatusBadge status={session.status} />
                    </div>

                    {/* Summary */}
                    {session.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {session.summary}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatDuration(session.duration)}</span>
                      </div>
                      <span>{formatDate(session.createdAt)}</span>
                      {session.language && (
                        <Badge variant="outline" className="text-xs">
                          {session.language.toUpperCase()}
                        </Badge>
                      )}
                    </div>

                    {/* Tags */}
                    {session.tags && (
                      <div className="flex flex-wrap gap-2">
                        {session.tags.split(',').map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {tag.trim()}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(session.id);
                    }}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {sessions.length >= pageSize && (
            <div className="flex justify-center gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                이전
              </Button>
              <Button variant="outline" disabled>
                {page}
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={sessions.length < pageSize || loading}
              >
                다음
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="세션 삭제"
        description="이 세션을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
      />
    </div>
  );
}

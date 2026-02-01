import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { RecordingPanel } from '../components/recording/RecordingPanel';
import { TranscriptionResultCard } from '../components/TranscriptionResultCard';
import { useSession } from '../hooks/useSession';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/use-toast';
import { Clock, FileAudio, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@common/types/session';
import type { TranscriptionSegment } from '@common/types/ipc';

export function DashboardPage() {
  const { user } = useAuth();
  const { sessions, loading, fetchSessions } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // 현재 완료된 세션 (전사 결과 표시용)
  const [completedSession, setCompletedSession] = useState<Session | null>(null);
  const [completedSegments, setCompletedSegments] = useState<TranscriptionSegment[] | null>(null);
  const [completedRefinedText, setCompletedRefinedText] = useState<string | null>(null);
  const [completedFormalText, setCompletedFormalText] = useState<string | null>(null);
  
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalDuration: 0,
  });

  useEffect(() => {
    if (user?.id) {
      // Fetch recent 5 sessions
      fetchSessions({
        userId: user.id,
        limit: 5,
      });
    }
  }, [user?.id, fetchSessions]);

  useEffect(() => {
    // Calculate stats from all sessions
    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((acc, session) => acc + (session.duration || 0), 0);
    setStats({ totalSessions, totalDuration });
  }, [sessions]);

  // 녹음 완료 시 호출 - 세션으로 이동하지 않고 결과 표시
  // 이 콜백은 전사/정제/저장이 모두 완료된 후에 호출됨
  const handleRecordingComplete = useCallback((
    session: Session, 
    segments?: TranscriptionSegment[],
    refinedText?: string,
    formalText?: string
  ) => {
    setCompletedSession(session);
    setCompletedSegments(segments || null);
    setCompletedRefinedText(refinedText || null);
    setCompletedFormalText(formalText || null);
    // 모든 절차가 완료된 후 토스트 표시
    toast({
      title: '처리 완료',
      description: '전사 및 정제가 완료되었습니다.',
    });
    // 세션 목록 새로고침
    if (user?.id) {
      fetchSessions({
        userId: user.id,
        limit: 5,
      });
    }
  }, [toast, user?.id, fetchSessions]);

  // 새 녹음 시작 시 - 완료된 세션 결과 숨기기
  const handleNewRecording = useCallback(() => {
    setCompletedSession(null);
    setCompletedSegments(null);
    setCompletedRefinedText(null);
    setCompletedFormalText(null);
  }, []);

  // 세션 상세 보기
  const handleViewSession = useCallback(() => {
    if (completedSession) {
      navigate(`/sessions/${completedSession.id}`);
    }
  }, [completedSession, navigate]);

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (ms: number) => {
    const totalMinutes = Math.floor(ms / 1000 / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">대시보드</h2>
        <p className="text-muted-foreground">음성 녹음 및 전사를 시작하세요</p>
      </div>

      {/* 완료된 전사 결과 (있을 때만 표시) */}
      {completedSession && (
        <TranscriptionResultCard
          session={completedSession}
          segments={completedSegments || undefined}
          refinedText={completedRefinedText || undefined}
          formalText={completedFormalText || undefined}
          onViewSession={handleViewSession}
          onNewRecording={handleNewRecording}
        />
      )}

      {/* Recording Panel */}
      <RecordingPanel 
        onRecordingComplete={handleRecordingComplete}
        onRecordingStart={handleNewRecording}
      />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 세션</CardTitle>
            <FileAudio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSessions}개</div>
            <p className="text-xs text-muted-foreground">녹음된 세션 수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 녹음 시간</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTotalDuration(stats.totalDuration)}</div>
            <p className="text-xs text-muted-foreground">누적 녹음 시간</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>최근 세션</CardTitle>
          <CardDescription>최근 5개의 녹음 세션</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">아직 녹음된 세션이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => navigate(`/sessions/${session.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">
                        {session.title || '제목 없음'}
                      </h4>
                      <Badge variant={session.status === 'COMPLETED' ? 'default' : 'secondary'}>
                        {session.status === 'COMPLETED' ? '완료' : session.status === 'DRAFT' ? '임시저장' : '보관됨'}
                      </Badge>
                    </div>
                    {session.summary && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {session.summary}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {session.duration ? formatDuration(session.duration) : '-'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(session.createdAt), {
                          addSuffix: true,
                          locale: ko,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

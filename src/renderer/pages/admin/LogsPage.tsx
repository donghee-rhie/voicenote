import React, { useEffect, useState } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { useToast } from '../../components/ui/use-toast';

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

export function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();
  }, [actionFilter, page]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadLogs();
      }, 5000); // Refresh every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, actionFilter, page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const filters: any = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };

      if (actionFilter !== 'all') {
        filters.action = actionFilter;
      }

      const result = await window.electronAPI.invoke('admin:logs', filters);
      if (result.success && result.data) {
        setLogs(result.data);
      } else {
        toast({
          title: '오류',
          description: result.error || '로그를 불러올 수 없습니다',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '로그를 불러오는 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getActionBadgeVariant = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('create') || actionLower.includes('생성')) {
      return 'default';
    }
    if (actionLower.includes('update') || actionLower.includes('수정')) {
      return 'secondary';
    }
    if (actionLower.includes('delete') || actionLower.includes('삭제')) {
      return 'destructive';
    }
    if (actionLower.includes('login') || actionLower.includes('로그인')) {
      return 'outline';
    }
    return 'secondary';
  };

  const getActionLabel = (action: string): string => {
    const actionMap: Record<string, string> = {
      'user:login': '로그인',
      'user:logout': '로그아웃',
      'user:create': '사용자 생성',
      'user:update': '사용자 수정',
      'user:delete': '사용자 삭제',
      'session:create': '세션 생성',
      'session:update': '세션 수정',
      'session:delete': '세션 삭제',
      'settings:update': '설정 변경',
    };
    return actionMap[action] || action;
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (logs.length === pageSize) {
      setPage(page + 1);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>활동 로그</CardTitle>
              <CardDescription>시스템 활동 및 사용자 활동을 확인합니다</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 mr-4">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
                  자동 새로고침
                </Label>
              </div>
              <Button onClick={loadLogs} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                새로고침
              </Button>
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="작업 유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="user:login">로그인</SelectItem>
                <SelectItem value="user:logout">로그아웃</SelectItem>
                <SelectItem value="user:create">사용자 생성</SelectItem>
                <SelectItem value="user:update">사용자 수정</SelectItem>
                <SelectItem value="user:delete">사용자 삭제</SelectItem>
                <SelectItem value="session:create">세션 생성</SelectItem>
                <SelectItem value="session:update">세션 수정</SelectItem>
                <SelectItem value="session:delete">세션 삭제</SelectItem>
                <SelectItem value="settings:update">설정 변경</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">로그가 없습니다</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>시간</TableHead>
                    <TableHead>사용자</TableHead>
                    <TableHead>작업</TableHead>
                    <TableHead>상세</TableHead>
                    <TableHead>IP 주소</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell>{log.userName || log.userId}</TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {getActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.details || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.ipAddress || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  페이지 {page} ({logs.length}개 항목)
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    이전
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={logs.length < pageSize}
                  >
                    다음
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

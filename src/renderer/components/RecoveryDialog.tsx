import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, HardDrive, Trash2 } from 'lucide-react';

interface RecoveryItem {
  sessionId: string;
  chunkCount: number;
  totalSize: number;
  lastModified: number;
}

interface RecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecover: (sessionId: string, audioPath: string) => void;
  onDiscardAll: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / (60 * 1000));
    return `${mins}분 전`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}시간 전`;
  }
  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RecoveryDialog({
  open,
  onOpenChange,
  onRecover,
  onDiscardAll,
}: RecoveryDialogProps) {
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [recovering, setRecovering] = useState<string | null>(null);

  useEffect(() => {
    if (open && window.electronAPI) {
      window.electronAPI.invoke('audio:recover-chunks').then((result: any) => {
        if (result.success && result.data) {
          setItems(result.data);
        }
      }).catch(console.error);
    }
  }, [open]);

  const handleRecover = async (sessionId: string) => {
    if (!window.electronAPI) return;
    setRecovering(sessionId);

    try {
      // Request main process to merge chunks and return audio path
      const result = await window.electronAPI.invoke('audio:recover-chunks', sessionId);
      if (result.success && result.data?.audioPath) {
        onRecover(sessionId, result.data.audioPath);
        setItems(prev => prev.filter(item => item.sessionId !== sessionId));
      }
    } catch (err) {
      console.error('[Recovery] Failed to recover:', err);
    } finally {
      setRecovering(null);
    }
  };

  const handleDiscard = async (sessionId: string) => {
    if (!window.electronAPI) return;

    try {
      await window.electronAPI.invoke('audio:cleanup-chunks', sessionId);
      setItems(prev => prev.filter(item => item.sessionId !== sessionId));
    } catch (err) {
      console.error('[Recovery] Failed to discard:', err);
    }
  };

  const handleDiscardAll = async () => {
    if (!window.electronAPI) return;

    try {
      for (const item of items) {
        await window.electronAPI.invoke('audio:cleanup-chunks', item.sessionId);
      }
      setItems([]);
      onDiscardAll();
      onOpenChange(false);
    } catch (err) {
      console.error('[Recovery] Failed to discard all:', err);
    }
  };

  if (items.length === 0 && open) {
    onOpenChange(false);
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            미완료 녹음 발견
          </DialogTitle>
          <DialogDescription>
            이전에 완료되지 않은 녹음이 발견되었습니다.
            복구하거나 삭제할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-60 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.sessionId}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {item.chunkCount}개 청크 · {formatSize(item.totalSize)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(item.lastModified)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDiscard(item.sessionId)}
                  disabled={recovering === item.sessionId}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleRecover(item.sessionId)}
                  disabled={recovering !== null}
                >
                  {recovering === item.sessionId ? '복구 중...' : '복구'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleDiscardAll}>
            모두 삭제
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            나중에
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

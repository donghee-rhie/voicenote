import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface PartialResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalChunks: number;
  failedChunks: number;
  stage: 'transcription' | 'refinement';
  onAccept: () => void;
  onRetry: () => void;
}

export function PartialResultDialog({
  open,
  onOpenChange,
  totalChunks,
  failedChunks,
  stage,
  onAccept,
  onRetry,
}: PartialResultDialogProps) {
  const successChunks = totalChunks - failedChunks;
  const successRate = Math.round((successChunks / totalChunks) * 100);
  const stageLabel = stage === 'transcription' ? '전사' : '정제';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            일부 {stageLabel} 실패
          </DialogTitle>
          <DialogDescription>
            {totalChunks}개 청크 중 {failedChunks}개의 {stageLabel}에 실패했습니다.
            실패한 부분은 원본 텍스트로 대체됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Success/Failure summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  {successChunks}개 성공
                </p>
                <p className="text-xs text-green-600/70 dark:text-green-500/70">
                  {successRate}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-red-50 dark:bg-red-950/20">
              <XCircle className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  {failedChunks}개 실패
                </p>
                <p className="text-xs text-red-600/70 dark:text-red-500/70">
                  {100 - successRate}%
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            부분 결과를 사용하시면 실패한 청크는 원문으로 포함됩니다.
            재시도하면 실패한 청크만 다시 처리합니다.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onRetry}>
            재시도
          </Button>
          <Button onClick={onAccept}>
            부분 결과 사용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

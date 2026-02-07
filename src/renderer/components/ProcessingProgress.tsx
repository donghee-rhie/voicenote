import React from 'react';
import { Progress } from './ui/progress';
import { cn } from '@/lib/utils';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import type { ProcessingProgress as ProcessingProgressData, ProcessingStage } from '@common/types/ipc';

interface ProcessingProgressProps {
  data: ProcessingProgressData | null;
  className?: string;
}

const STAGE_ORDER: ProcessingStage[] = ['chunking', 'transcribing', 'merging', 'refining', 'summarizing'];

const STAGE_LABELS: Record<ProcessingStage, string> = {
  chunking: '오디오 분할',
  transcribing: '전사',
  merging: '결과 병합',
  refining: '텍스트 정제',
  summarizing: '요약 생성',
};

function formatRemainingTime(ms?: number): string | null {
  if (!ms || ms <= 0) return null;
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `약 ${seconds}초`;
  const minutes = Math.ceil(seconds / 60);
  return `약 ${minutes}분`;
}

/**
 * ProcessingProgress - displays chunk-by-chunk processing progress
 * for long recording transcription and refinement
 */
export function ProcessingProgress({ data, className }: ProcessingProgressProps) {
  if (!data) return null;

  const {
    stage,
    stageLabel,
    currentChunk,
    totalChunks,
    overallProgress,
    estimatedRemainingMs,
    chunkResults = 0,
    chunkErrors = 0,
  } = data;

  const remaining = formatRemainingTime(estimatedRemainingMs);
  const currentStageIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div className={cn('w-full space-y-3 p-4 rounded-lg border bg-card', className)}>
      {/* Stage indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">
            {stageLabel || STAGE_LABELS[stage]}
          </span>
        </div>
        {totalChunks > 1 && (
          <span className="text-xs text-muted-foreground">
            {currentChunk}/{totalChunks} 청크
          </span>
        )}
      </div>

      {/* Progress bar */}
      <Progress value={overallProgress} className="h-2" />

      {/* Details row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{Math.round(overallProgress)}%</span>
        {remaining && <span>예상 남은 시간: {remaining}</span>}
      </div>

      {/* Stage dots */}
      {totalChunks > 1 && (
        <div className="flex items-center gap-1 pt-1">
          {STAGE_ORDER.map((s, i) => (
            <div
              key={s}
              className={cn(
                'flex items-center gap-1',
                i < currentStageIndex && 'text-green-600',
                i === currentStageIndex && 'text-primary font-medium',
                i > currentStageIndex && 'text-muted-foreground'
              )}
            >
              {i < currentStageIndex ? (
                <Check className="h-3 w-3" />
              ) : i === currentStageIndex ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <div className="h-3 w-3 rounded-full border border-muted-foreground/30" />
              )}
              <span className="text-[10px]">{STAGE_LABELS[s]}</span>
              {i < STAGE_ORDER.length - 1 && (
                <div className="w-2 h-px bg-muted-foreground/30 mx-0.5" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error indicator */}
      {chunkErrors > 0 && (
        <div className="flex items-center gap-1 text-xs text-amber-600">
          <AlertCircle className="h-3 w-3" />
          <span>{chunkErrors}개 청크 실패 (재시도 중...)</span>
        </div>
      )}
    </div>
  );
}

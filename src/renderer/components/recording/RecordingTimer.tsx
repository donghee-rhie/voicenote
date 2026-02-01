import React from 'react';
import { cn } from '@/lib/utils';

interface RecordingTimerProps {
  duration: number; // seconds
  isRecording: boolean;
  maxDuration?: number; // seconds
  isWarning?: boolean; // 경고 상태 (종료 임박)
  className?: string;
}

/**
 * Timer display component for recording duration
 * Shows MM:SS format with animated recording indicator
 * Supports max duration progress and warning state
 * Memoized to prevent unnecessary re-renders from frequently changing props
 */
export const RecordingTimer = React.memo(function RecordingTimer({
  duration,
  isRecording,
  maxDuration = 300,
  isWarning = false,
  className
}: RecordingTimerProps) {
  // Convert seconds to MM:SS
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;

  // 최대 시간 포맷
  const maxMinutes = Math.floor(maxDuration / 60);
  const maxSeconds = maxDuration % 60;
  const formattedMaxTime = `${maxMinutes.toString().padStart(2, '0')}:${maxSeconds
    .toString()
    .padStart(2, '0')}`;

  // 진행률 계산
  const progressPercent = Math.min((duration / maxDuration) * 100, 100);

  // 색상 결정: 경고 상태면 노란색→빨간색, 아니면 빨간색→회색
  const getTimerColor = () => {
    if (!isRecording) return 'text-muted-foreground';
    if (isWarning) return 'text-orange-500 animate-pulse';
    return 'text-red-600';
  };

  const getProgressColor = () => {
    if (isWarning) return 'bg-orange-500';
    if (progressPercent > 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="flex items-center gap-2">
        {isRecording && (
          <span className="relative flex h-2 w-2">
            <span className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              isWarning ? 'bg-orange-400' : 'bg-red-400'
            )}></span>
            <span className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              isWarning ? 'bg-orange-500' : 'bg-red-500'
            )}></span>
          </span>
        )}
        <span
          className={cn(
            'font-mono text-4xl font-bold tabular-nums tracking-tight',
            getTimerColor()
          )}
        >
          {formattedTime}
        </span>
        {isRecording && (
          <span className="text-lg text-muted-foreground font-mono">
            / {formattedMaxTime}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {isRecording && (
        <div className="w-full max-w-xs h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-1000 ease-linear rounded-full',
              getProgressColor()
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Warning message */}
      {isWarning && (
        <p className="text-sm text-orange-500 font-medium animate-pulse">
          녹음이 곧 종료됩니다
        </p>
      )}
    </div>
  );
});

import React from 'react';
import { cn } from '@/lib/utils';

interface AudioLevelMeterProps {
  level: number; // 0-100
  isRecording: boolean;
  className?: string;
}

/**
 * Audio level visualization component
 * Shows horizontal bar with color gradient based on level
 * Memoized to prevent unnecessary re-renders from frequently changing props
 */
export const AudioLevelMeter = React.memo(function AudioLevelMeter({
  level,
  isRecording,
  className
}: AudioLevelMeterProps) {
  // Determine color based on level
  const getColor = () => {
    if (level < 30) return 'bg-green-500';
    if (level < 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">음량</span>
        <span className="text-sm font-medium text-muted-foreground">{Math.round(level)}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            'h-full transition-all duration-100 ease-out',
            isRecording ? getColor() : 'bg-muted-foreground/30'
          )}
          style={{ width: `${level}%` }}
        />
      </div>
    </div>
  );
});

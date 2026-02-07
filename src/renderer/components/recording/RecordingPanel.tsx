import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkflow } from '@/hooks/useWorkflow';
import { RecordingTimer } from './RecordingTimer';
import { AudioLevelMeter } from './AudioLevelMeter';
import { AudioDropZone } from '@/components/AudioDropZone';
import { ProcessingProgress } from '@/components/ProcessingProgress';
import { Mic, Square, Loader2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { setLastSessionText } from '@/layouts/MainLayout';
import type { Session } from '@common/types/session';
import type { TranscriptionSegment } from '@common/types/ipc';

interface RecordingPanelProps {
  onRecordingComplete?: (session: Session, segments?: TranscriptionSegment[], refinedText?: string, formalText?: string) => void;
  onRecordingStart?: () => void;
  className?: string;
}

/**
 * Memoized recording controls component
 */
const RecordingControls = React.memo(function RecordingControls({
  isRecording,
  isProcessing,
  status,
  isWarning,
  onStart,
  onStop,
}: {
  isRecording: boolean;
  isProcessing: boolean;
  status: string;
  isWarning: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div className="relative">
      {!isRecording ? (
        <Button
          size="lg"
          onClick={onStart}
          disabled={isProcessing || status === 'error'}
          className={cn(
            'h-32 w-32 rounded-full shadow-lg transition-all hover:scale-105',
            'bg-red-500 hover:bg-red-600'
          )}
        >
          {isProcessing ? (
            <Loader2 className="h-12 w-12 animate-spin text-white" />
          ) : (
            <Mic className="h-12 w-12 text-white" />
          )}
        </Button>
      ) : (
        <div className="relative">
          {/* Pulse animation ring */}
          <div className={cn(
            'absolute -inset-4 animate-ping rounded-full opacity-20',
            isWarning ? 'bg-orange-500' : 'bg-red-500'
          )} />
          <Button
            size="lg"
            onClick={onStop}
            className={cn(
              'h-32 w-32 rounded-full shadow-lg transition-all hover:scale-105',
              isWarning 
                ? 'bg-orange-500 hover:bg-orange-600 animate-pulse' 
                : 'bg-red-600 hover:bg-red-700 animate-pulse'
            )}
          >
            <Square className="h-12 w-12 fill-current text-white" />
          </Button>
        </div>
      )}
    </div>
  );
});

/**
 * Memoized status text component
 */
const StatusText = React.memo(function StatusText({
  error,
  progress,
  isRecording,
  mode,
  onRetry,
}: {
  error: string | null;
  progress: string | null;
  isRecording: boolean;
  mode: 'toggle' | 'push-to-talk';
  onRetry: () => void;
}) {
  return (
    <div className="text-center space-y-2">
      {error ? (
        <>
          <p className="text-sm text-destructive font-medium">{error}</p>
          <Button onClick={onRetry} variant="outline" size="sm">
            다시 시도
          </Button>
        </>
      ) : progress ? (
        <p className="text-sm text-muted-foreground">{progress}</p>
      ) : isRecording ? (
        <p className="text-sm text-muted-foreground">
          {mode === 'push-to-talk' 
            ? '키를 떼면 녹음이 중지됩니다.'
            : '녹음 중입니다. 완료하려면 중지 버튼을 누르세요.'}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          마이크 버튼을 눌러 녹음을 시작하세요.
        </p>
      )}
    </div>
  );
});

/**
 * Main recording component for the dashboard
 * Provides recording controls with real-time feedback
 * Integrated with full workflow including transcription and refinement
 */
export function RecordingPanel({ onRecordingComplete, onRecordingStart, className }: RecordingPanelProps) {
  const { toast } = useToast();
  const {
    status,
    startWorkflow,
    stopWorkflow,
    cancelWorkflow,
    currentSession,
    currentSegments,
    currentRefinedText,
    currentFormalText,
    error,
    progress,
    processingProgress,
    // Recording state
    isRecording,
    duration,
    audioLevel,
    mode,
    maxDuration,
    isWarning,
  } = useWorkflow({
    onWarning: (message) => {
      toast({
        title: '녹음 종료 임박',
        description: message,
        variant: 'destructive',
      });
    },
    onAutoCopy: () => {
      toast({
        title: '자동 복사됨',
        description: '텍스트가 클립보드에 복사되었습니다.',
      });
    },
  });

  // 완료 시 콜백 호출 및 마지막 텍스트 저장
  const prevStatusRef = React.useRef(status);
  React.useEffect(() => {
    if (prevStatusRef.current !== 'complete' && status === 'complete' && currentSession) {
      // 마지막 텍스트 저장 (클립보드 복사용)
      const textForClipboard = currentFormalText || currentRefinedText || currentSession.refinedText;
      if (textForClipboard) {
        setLastSessionText(textForClipboard);
      }
      // 완료 콜백 호출 (segments, refinedText, formalText 포함)
      onRecordingComplete?.(
        currentSession, 
        currentSegments || undefined, 
        currentRefinedText || undefined, 
        currentFormalText || undefined
      );
    }
    prevStatusRef.current = status;
  }, [status, currentSession, currentSegments, currentRefinedText, currentFormalText, onRecordingComplete]);

  const handleStart = async () => {
    onRecordingStart?.();
    await startWorkflow();
  };

  const handleStop = async () => {
    await stopWorkflow();
  };

  const handleRetry = () => {
    cancelWorkflow();
  };

  // Listen for toggle-recording event from MainLayout (triggered by global shortcut)
  React.useEffect(() => {
    const handleToggleRecording = async () => {
      console.log('Toggle recording event received, isRecording:', isRecording, 'status:', status);
      if (isRecording) {
        await stopWorkflow();
      } else if (status === 'idle' || status === 'complete' || status === 'error') {
        // idle, complete, error 상태에서 녹음 시작 가능
        onRecordingStart?.();
        await startWorkflow();
      }
    };

    window.addEventListener('toggle-recording', handleToggleRecording);
    return () => {
      window.removeEventListener('toggle-recording', handleToggleRecording);
    };
  }, [isRecording, status, startWorkflow, stopWorkflow, onRecordingStart]);

  const getStatusText = () => {
    switch (status) {
      case 'recording':
        return '녹음 중...';
      case 'transcribing':
        return '변환 중...';
      case 'refining':
        return '정제 중...';
      case 'saving':
        return '저장 중...';
      case 'complete':
        return '완료!';
      case 'error':
        return '오류';
      default:
        return '준비';
    }
  };

  const getStatusVariant = () => {
    switch (status) {
      case 'recording':
        return isWarning ? 'warning' : 'destructive';
      case 'transcribing':
      case 'refining':
      case 'saving':
        return 'secondary';
      case 'complete':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const isProcessing = ['transcribing', 'refining', 'saving'].includes(status);
  // complete 상태에서도 녹음 UI 표시 (결과는 DashboardPage에서 표시)
  const showRecordingUI = status !== 'complete' || !currentSession;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>음성 녹음</CardTitle>
            <CardDescription>
              {status === 'complete' 
                ? '새 녹음을 시작하세요'
                : '녹음 버튼을 눌러 시작하세요'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode Badge */}
            {isRecording && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Radio className="h-3 w-3" />
                {mode === 'push-to-talk' ? 'Push-to-Talk' : 'Toggle'}
              </Badge>
            )}
            <Badge variant={getStatusVariant() as any}>{getStatusText()}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          <div className="flex flex-col items-center space-y-8 py-8">
            {/* Recording Timer */}
            <RecordingTimer 
              duration={duration} 
              isRecording={isRecording}
              maxDuration={maxDuration}
              isWarning={isWarning}
            />

            {/* Record Button */}
            <RecordingControls
              isRecording={isRecording}
              isProcessing={isProcessing}
              status={status}
              isWarning={isWarning}
              onStart={handleStart}
              onStop={handleStop}
            />

            {/* Audio Level Meter */}
            <div className="w-full max-w-md">
              <AudioLevelMeter level={audioLevel} isRecording={isRecording} />
            </div>

            {/* Status Text */}
            <StatusText
              error={error}
              progress={processingProgress ? null : progress}
              isRecording={isRecording}
              mode={mode}
              onRetry={handleRetry}
            />
          </div>

          {/* Processing Progress (for chunked transcription/refinement) */}
          {isProcessing && processingProgress && (
            <ProcessingProgress data={processingProgress} />
          )}

          {/* Audio Drop Zone */}
          {!isRecording && !isProcessing && (status === 'idle' || status === 'complete') && (
            <div className="border-t pt-6">
              <AudioDropZone />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

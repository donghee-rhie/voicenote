import React, { useState, useCallback, DragEvent } from 'react';
import { Music, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotification } from '@/hooks/useNotification';

interface AudioDropZoneProps {
  onFileAccepted?: (audioPath: string, durationSec: number) => void;
  className?: string;
  disabled?: boolean;
}

const MAX_FILE_SIZE_MB = 500; // 500MB max

const ACCEPTED_AUDIO_TYPES = [
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg',
];

const ACCEPTED_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.webm', '.ogg', '.mp4'];

/**
 * AudioDropZone component for drag-and-drop audio file upload
 * Validates file and passes the native file path + duration to parent.
 * The parent (RecordingPanel/useWorkflow) handles the full workflow.
 */
export function AudioDropZone({
  onFileAccepted,
  className,
  disabled = false,
}: AudioDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const notification = useNotification();

  const getAudioDuration = useCallback((file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        const duration = isFinite(audio.duration) ? Math.round(audio.duration) : 0;
        resolve(duration);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      audio.src = url;
    });
  }, []);

  const validateAudioFile = useCallback((file: File): string | null => {
    const isValidType = ACCEPTED_AUDIO_TYPES.includes(file.type);
    const hasValidExtension = ACCEPTED_EXTENSIONS.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!isValidType && !hasValidExtension) {
      return '지원하지 않는 파일 형식입니다. (.wav, .mp3, .m4a, .webm, .ogg)';
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      return `파일 크기가 너무 큽니다. (${sizeMB.toFixed(0)}MB, 최대 ${MAX_FILE_SIZE_MB}MB)`;
    }

    return null;
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (disabled || isProcessing) return;

      const validationError = validateAudioFile(file);
      if (validationError) {
        notification.error('파일 검증 실패', validationError);
        return;
      }

      setIsProcessing(true);

      try {
        // Get audio duration
        const durationSec = await getAudioDuration(file);
        console.log(`[AudioDropZone] File: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(1)}MB, duration: ${durationSec}s`);

        if (durationSec > 7200) {
          notification.error('파일이 너무 깁니다', '최대 2시간까지의 오디오 파일을 지원합니다.');
          setIsProcessing(false);
          return;
        }

        // In Electron, dropped/selected files have a .path property with the native file path
        const filePath = (file as any).path as string;
        if (!filePath) {
          throw new Error('파일 경로를 가져올 수 없습니다');
        }

        console.log(`[AudioDropZone] Native file path: ${filePath}`);

        // Pass to parent for full workflow processing
        onFileAccepted?.(filePath, durationSec);
      } catch (error) {
        console.error('Audio file processing error:', error);
        notification.error(
          '파일 처리 실패',
          error instanceof Error ? error.message : '파일 처리 중 오류가 발생했습니다'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [disabled, isProcessing, validateAudioFile, getAudioDuration, notification, onFileAccepted]
  );

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isProcessing) {
        setIsDragOver(true);
      }
    },
    [disabled, isProcessing]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    },
    []
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled || isProcessing) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, isProcessing, handleFile]
  );

  const handleClick = useCallback(() => {
    if (disabled || isProcessing) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_AUDIO_TYPES.join(',') + ',' + ACCEPTED_EXTENSIONS.join(',');
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFile(file);
      }
    };
    input.click();
  }, [disabled, isProcessing, handleFile]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={cn(
        'relative flex flex-col items-center justify-center',
        'min-h-[200px] rounded-lg border-2 border-dashed',
        'transition-all duration-200 cursor-pointer',
        'bg-background hover:bg-accent/5',
        isDragOver && !disabled && !isProcessing
          ? 'border-primary bg-primary/5 scale-[1.02]'
          : 'border-muted-foreground/25',
        (disabled || isProcessing) && 'cursor-not-allowed opacity-60',
        className
      )}
    >
      {isProcessing ? (
        <div className="flex flex-col items-center gap-4 p-8">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground">
              파일 확인 중...
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 p-8">
          <div className="relative">
            <Music className="h-12 w-12 text-muted-foreground" />
            <Upload className="h-6 w-6 text-muted-foreground absolute -bottom-1 -right-1" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground">
              오디오 파일을 드래그하세요
            </p>
            <p className="text-xs text-muted-foreground">
              또는 클릭하여 파일 선택
            </p>
            <p className="text-xs text-muted-foreground/75 mt-2">
              WAV, MP3, M4A, WebM, OGG (최대 2시간)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

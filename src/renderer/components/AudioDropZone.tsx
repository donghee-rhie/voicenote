import React, { useState, useCallback, DragEvent } from 'react';
import { Music, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotification } from '@/hooks/useNotification';
import { invokeElectron } from '@/hooks/useElectronAPI';
import { IPC_CHANNELS } from '@common/types/ipc';

interface AudioDropZoneProps {
  onFileAccepted?: (audioPath: string) => void;
  className?: string;
  disabled?: boolean;
}

const ACCEPTED_AUDIO_TYPES = [
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg',
];

const ACCEPTED_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.webm', '.ogg'];

/**
 * AudioDropZone component for drag-and-drop audio file upload
 * Features:
 * - Visual feedback on drag over
 * - Audio file type validation
 * - Automatic transcription trigger
 * - Loading state management
 * - Error handling with toast notifications
 */
export function AudioDropZone({
  onFileAccepted,
  className,
  disabled = false,
}: AudioDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const notification = useNotification();

  const validateAudioFile = useCallback((file: File): boolean => {
    // Check file type
    const isValidType = ACCEPTED_AUDIO_TYPES.includes(file.type);
    const hasValidExtension = ACCEPTED_EXTENSIONS.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    return isValidType || hasValidExtension;
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (disabled || isProcessing) return;

      // Validate file type
      if (!validateAudioFile(file)) {
        notification.error(
          '지원하지 않는 파일 형식',
          '오디오 파일만 업로드할 수 있습니다 (.wav, .mp3, .m4a, .webm, .ogg)'
        );
        return;
      }

      setIsProcessing(true);

      try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Save audio blob to file via IPC
        const saveResult = await invokeElectron<{ success: boolean; data?: { path: string }; error?: string }>(
          IPC_CHANNELS.AUDIO.SAVE_BLOB,
          Array.from(buffer),
          file.name
        );

        if (!saveResult.success || !saveResult.data?.path) {
          throw new Error(saveResult.error || '파일 저장에 실패했습니다');
        }

        const audioPath = saveResult.data.path;

        // Notify parent component
        onFileAccepted?.(audioPath);

        // Start transcription
        const transcriptionResult = await invokeElectron<{ success: boolean; error?: string }>(
          IPC_CHANNELS.TRANSCRIPTION.START,
          { audioPath }
        );

        if (!transcriptionResult.success) {
          throw new Error(transcriptionResult.error || '변환 시작에 실패했습니다');
        }

        notification.info('변환 시작', '오디오 파일을 변환하고 있습니다...');
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
    [disabled, isProcessing, validateAudioFile, notification, onFileAccepted]
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
              파일 처리 중...
            </p>
            <p className="text-xs text-muted-foreground">
              잠시만 기다려주세요
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
              WAV, MP3, M4A, WebM, OGG
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

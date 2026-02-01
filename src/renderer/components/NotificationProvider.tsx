import React, { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { useNotification } from '@/hooks/useNotification';
import { subscribeElectron } from '@/hooks/useElectronAPI';
import { IPC_CHANNELS } from '@common/types/ipc';

/**
 * Inner component that handles IPC event subscriptions
 * Separated to ensure hooks are called within the toast context
 */
function NotificationListener({ children }: { children: React.ReactNode }) {
  const notification = useNotification();

  useEffect(() => {
    // Subscribe to workflow complete event
    const unsubWorkflowComplete = subscribeElectron(
      'workflow:complete',
      (data: any) => {
        notification.success('작업 완료', data?.message || '워크플로우가 성공적으로 완료되었습니다');
      }
    );

    // Subscribe to workflow error event
    const unsubWorkflowError = subscribeElectron(
      'workflow:error',
      (data: any) => {
        notification.error('작업 실패', data?.message || '워크플로우 처리 중 오류가 발생했습니다');
      }
    );

    // Subscribe to transcription complete event
    const unsubTranscriptionComplete = subscribeElectron(
      IPC_CHANNELS.TRANSCRIPTION.COMPLETE,
      () => {
        notification.success('변환 완료', '음성이 텍스트로 변환되었습니다');
      }
    );

    // Subscribe to transcription error event
    const unsubTranscriptionError = subscribeElectron(
      IPC_CHANNELS.TRANSCRIPTION.ERROR,
      (data: any) => {
        notification.error('변환 실패', data?.message || '음성 변환 중 오류가 발생했습니다');
      }
    );

    // Subscribe to refinement complete event
    const unsubRefinementComplete = subscribeElectron(
      IPC_CHANNELS.REFINEMENT.COMPLETE,
      () => {
        notification.success('정제 완료', '텍스트가 성공적으로 정제되었습니다');
      }
    );

    // Subscribe to refinement error event
    const unsubRefinementError = subscribeElectron(
      IPC_CHANNELS.REFINEMENT.ERROR,
      (data: any) => {
        notification.error('정제 실패', data?.message || '텍스트 정제 중 오류가 발생했습니다');
      }
    );

    // Cleanup subscriptions on unmount
    return () => {
      unsubWorkflowComplete();
      unsubWorkflowError();
      unsubTranscriptionComplete();
      unsubTranscriptionError();
      unsubRefinementComplete();
      unsubRefinementError();
    };
  }, [notification]);

  return <>{children}</>;
}

/**
 * NotificationProvider component that wraps the application with toast notifications
 * and subscribes to IPC events for workflow status updates
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NotificationListener>{children}</NotificationListener>
      <Toaster />
    </>
  );
}

/**
 * Common Components Usage Examples
 *
 * This file demonstrates how to use all the common/shared components
 * created for the Electron app.
 */

import React, { useState } from 'react';
import { ShortcutsHelp } from './ShortcutsHelp';
import { ErrorBoundary } from './ErrorBoundary';
import {
  LoadingSpinner,
  LoadingOverlay,
  InlineLoading,
} from './LoadingSpinner';
import { EmptyState } from './EmptyState';
import { ConfirmDialog } from './ConfirmDialog';
import { StatusBadge } from './StatusBadge';
import { PageHeader } from './PageHeader';
import { Button } from './ui/button';
import { FileText, Plus } from 'lucide-react';

export function CommonComponentsExample() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  return (
    <div className="space-y-8 p-8">
      {/* Page Header */}
      <PageHeader
        title="공통 컴포넌트 예제"
        description="모든 페이지에서 사용할 수 있는 공통 컴포넌트들"
        action={
          <Button onClick={() => alert('액션 실행!')}>
            <Plus className="h-4 w-4 mr-2" />
            새로 만들기
          </Button>
        }
      />

      {/* Status Badges */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Status Badges</h2>
        <div className="flex gap-2">
          <StatusBadge status="ACTIVE" />
          <StatusBadge status="PENDING" />
          <StatusBadge status="INACTIVE" />
          <StatusBadge status="SUSPENDED" />
          <StatusBadge status="DRAFT" />
          <StatusBadge status="COMPLETED" />
        </div>
      </section>

      {/* Loading States */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Loading States</h2>
        <div className="space-y-4 border rounded-lg p-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Small Spinner:</p>
            <InlineLoading text="로딩 중..." />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Medium Spinner:
            </p>
            <LoadingSpinner size="md" text="데이터를 불러오는 중..." />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Large Spinner:</p>
            <LoadingSpinner size="lg" text="처리 중입니다..." />
          </div>
          <Button onClick={() => setShowLoading(true)}>
            Show Full Screen Loading
          </Button>
          {showLoading && (
            <LoadingOverlay text="전체 화면 로딩 중..." />
          )}
        </div>
      </section>

      {/* Empty State */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Empty State</h2>
        <EmptyState
          icon={FileText}
          title="세션이 없습니다"
          description="새로운 녹음 세션을 시작하여 음성을 텍스트로 변환하세요."
          action={{
            label: '녹음 시작',
            onClick: () => alert('녹음 시작!'),
          }}
        />
      </section>

      {/* Dialogs */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Dialogs</h2>
        <div className="flex gap-2">
          <Button onClick={() => setShowShortcuts(true)}>
            Show Shortcuts Help
          </Button>
          <Button onClick={() => setShowConfirm(true)} variant="destructive">
            Show Confirm Dialog
          </Button>
        </div>
      </section>

      {/* Error Boundary Example */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Error Boundary</h2>
        <div className="border rounded-lg p-4">
          <ErrorBoundary>
            <div>
              <p className="text-sm text-muted-foreground">
                이 컴포넌트는 에러 바운더리로 감싸져 있습니다.
              </p>
              <p className="text-sm text-muted-foreground">
                하위 컴포넌트에서 에러가 발생하면 폴백 UI가 표시됩니다.
              </p>
            </div>
          </ErrorBoundary>
        </div>
      </section>

      {/* Dialogs */}
      <ShortcutsHelp
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="세션을 삭제하시겠습니까?"
        description="이 작업은 되돌릴 수 없습니다. 세션의 모든 데이터가 영구적으로 삭제됩니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="destructive"
        onConfirm={() => {
          alert('삭제됨!');
          setShowConfirm(false);
        }}
      />

      {/* Close loading overlay after 3 seconds */}
      {showLoading && setTimeout(() => setShowLoading(false), 3000) && null}
    </div>
  );
}

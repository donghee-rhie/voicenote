# Common Components Documentation

This directory contains reusable components used across multiple pages in the Electron app.

## Components

### 1. ShortcutsHelp

Keyboard shortcuts reference dialog that displays available keyboard shortcuts to users.

**Features:**
- Mac-aware key display (shows ⌘ on Mac, Ctrl on Windows/Linux)
- Korean labels
- Uses Dialog from shadcn/ui

**Usage:**
```tsx
import { ShortcutsHelp } from '@/components/ShortcutsHelp';

const [showHelp, setShowHelp] = useState(false);

<ShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />
```

**Shortcuts Included:**
- Recording toggle: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
- Copy text: Ctrl+Shift+C (or Cmd+Shift+C on Mac)
- Cancel: Esc
- Help: ?

---

### 2. ErrorBoundary

React error boundary that catches JavaScript errors in child components and displays a fallback UI.

**Features:**
- Class component implementing componentDidCatch
- Korean error messages
- "다시 시도" (retry) button
- Optional custom fallback component

**Usage:**
```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary fallback={({ error, reset }) => (
  <div>
    <h1>Custom Error UI</h1>
    <p>{error.message}</p>
    <button onClick={reset}>Try Again</button>
  </div>
)}>
  <YourComponent />
</ErrorBoundary>
```

---

### 3. LoadingSpinner

Loading state indicators with multiple variants.

**Components:**
- `LoadingSpinner` - Basic spinner with optional text
- `LoadingOverlay` - Full-screen loading overlay
- `InlineLoading` - Small inline loading indicator

**Features:**
- Three sizes: sm, md, lg
- Optional loading text
- Full-screen mode with backdrop
- Animated SVG spinner

**Usage:**
```tsx
import { LoadingSpinner, LoadingOverlay, InlineLoading } from '@/components/LoadingSpinner';

// Basic spinner
<LoadingSpinner size="md" text="로딩 중..." />

// Full-screen overlay
<LoadingOverlay text="데이터를 불러오는 중..." />

// Inline loading
<InlineLoading text="처리 중..." />
```

**Props:**
- `size`: 'sm' | 'md' | 'lg'
- `text`: string (optional)
- `fullScreen`: boolean (default: false)
- `className`: string (optional)

---

### 4. EmptyState

Empty state placeholder for when lists or data are empty.

**Features:**
- Icon + title + description layout
- Optional action button
- Dashed border design

**Usage:**
```tsx
import { EmptyState } from '@/components/EmptyState';
import { FileText } from 'lucide-react';

<EmptyState
  icon={FileText}
  title="세션이 없습니다"
  description="새로운 녹음 세션을 시작하여 음성을 텍스트로 변환하세요."
  action={{
    label: '녹음 시작',
    onClick: () => startRecording()
  }}
/>
```

**Props:**
- `icon`: LucideIcon (optional)
- `title`: string
- `description`: string (optional)
- `action`: { label: string, onClick: () => void } (optional)
- `className`: string (optional)

---

### 5. ConfirmDialog

Reusable confirmation dialog for destructive or important actions.

**Features:**
- Confirm/Cancel buttons
- Default and destructive variants
- Loading state support
- Korean labels

**Usage:**
```tsx
import { ConfirmDialog } from '@/components/ConfirmDialog';

const [open, setOpen] = useState(false);

<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="세션을 삭제하시겠습니까?"
  description="이 작업은 되돌릴 수 없습니다."
  confirmLabel="삭제"
  cancelLabel="취소"
  variant="destructive"
  onConfirm={() => deleteSession()}
  onCancel={() => console.log('Cancelled')}
/>
```

**Props:**
- `open`: boolean
- `onOpenChange`: (open: boolean) => void
- `title`: string
- `description`: string (optional)
- `confirmLabel`: string (default: '확인')
- `cancelLabel`: string (default: '취소')
- `variant`: 'default' | 'destructive' (default: 'default')
- `onConfirm`: () => void
- `onCancel`: () => void (optional)
- `loading`: boolean (optional)

---

### 6. StatusBadge

Status indicator badge with predefined color mappings.

**Features:**
- Predefined status colors
- Korean status labels
- Based on shadcn/ui Badge component

**Usage:**
```tsx
import { StatusBadge, getStatusLabel } from '@/components/StatusBadge';

<StatusBadge status="ACTIVE" />
<StatusBadge status="PENDING" />
<StatusBadge status="COMPLETED" />

// Get label only
const label = getStatusLabel('ACTIVE'); // "활성"
```

**Status Mappings:**
- `ACTIVE` → 활성 (green)
- `PENDING` → 대기중 (yellow)
- `INACTIVE` → 비활성 (gray)
- `SUSPENDED` → 중단됨 (red)
- `DRAFT` → 초안 (blue)
- `COMPLETED` → 완료 (green)

**Props:**
- `status`: string
- `className`: string (optional)

---

### 7. PageHeader

Consistent page header with title, description, and action area.

**Features:**
- Title + optional description
- Right-aligned action area
- Separator below header

**Usage:**
```tsx
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

<PageHeader
  title="세션 관리"
  description="모든 녹음 세션을 확인하고 관리하세요"
  action={
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      새 세션
    </Button>
  }
/>
```

**Props:**
- `title`: string
- `description`: string (optional)
- `action`: ReactNode (optional)
- `className`: string (optional)

---

## Hooks

### useElectronAPI

Hook for making IPC calls to the main process with loading and error state management.

**Features:**
- Type-safe IPC invocation
- Automatic loading state
- Error handling
- Multiple helper functions

**Usage:**
```tsx
import { useElectronAPI, invokeElectron, subscribeElectron } from '@/hooks';

// With state management
function MyComponent() {
  const { invoke, loading, error } = useElectronAPI<SessionData>();

  const loadSession = async () => {
    try {
      const session = await invoke('session:get', sessionId);
      setSession(session);
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  return (
    <div>
      {loading && <LoadingSpinner />}
      {error && <p>Error: {error.message}</p>}
      <Button onClick={loadSession}>Load Session</Button>
    </div>
  );
}

// Direct invocation (no state)
const session = await invokeElectron<SessionData>('session:get', sessionId);

// Subscribe to events
useEffect(() => {
  const unsubscribe = subscribeElectron('audio:recording-state', (state) => {
    console.log('Recording state:', state);
  });
  return unsubscribe;
}, []);
```

**API:**
- `useElectronAPI<T>()`: Hook with loading/error state
  - Returns: `{ invoke, loading, error }`
- `invokeElectron<T>(channel, ...args)`: Direct invocation
- `subscribeElectron(channel, callback)`: Subscribe to events
- `sendElectron(channel, ...args)`: Send one-way message

---

## File Structure

```
src/renderer/components/
├── ShortcutsHelp.tsx          # Keyboard shortcuts dialog
├── ErrorBoundary.tsx          # React error boundary
├── LoadingSpinner.tsx         # Loading indicators
├── EmptyState.tsx             # Empty state placeholder
├── ConfirmDialog.tsx          # Confirmation dialog
├── StatusBadge.tsx            # Status badges
├── PageHeader.tsx             # Page header
├── CommonComponentsExample.tsx # Usage examples
├── index.ts                   # Barrel export
└── ui/                        # shadcn/ui components

src/renderer/hooks/
├── useElectronAPI.ts          # Electron IPC hook
└── index.ts                   # Barrel export
```

---

## Best Practices

1. **Import from barrel files:**
   ```tsx
   import { StatusBadge, PageHeader } from '@/components';
   import { useElectronAPI } from '@/hooks';
   ```

2. **Always wrap root component with ErrorBoundary:**
   ```tsx
   <ErrorBoundary>
     <YourApp />
   </ErrorBoundary>
   ```

3. **Use PageHeader for consistent page layouts:**
   ```tsx
   <div className="container py-6">
     <PageHeader title="Page Title" />
     {/* page content */}
   </div>
   ```

4. **Show loading states during async operations:**
   ```tsx
   {loading && <LoadingSpinner text="Loading..." />}
   ```

5. **Use EmptyState when data is empty:**
   ```tsx
   {sessions.length === 0 ? (
     <EmptyState title="No sessions" action={{ ... }} />
   ) : (
     <SessionList sessions={sessions} />
   )}
   ```

6. **Confirm destructive actions:**
   ```tsx
   <ConfirmDialog
     variant="destructive"
     title="Delete session?"
     onConfirm={handleDelete}
   />
   ```

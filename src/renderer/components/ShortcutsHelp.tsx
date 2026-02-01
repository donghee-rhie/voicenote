import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const shortcuts: Shortcut[] = [
  {
    keys: isMac ? ['⌘', 'Shift', 'R'] : ['Ctrl', 'Shift', 'R'],
    description: '녹음 토글',
  },
  {
    keys: isMac ? ['⌘', 'Shift', 'C'] : ['Ctrl', 'Shift', 'C'],
    description: '텍스트 복사',
  },
  {
    keys: ['Esc'],
    description: '취소',
  },
  {
    keys: ['?'],
    description: '도움말',
  },
];

export function ShortcutsHelp({ open, onOpenChange }: ShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            키보드 단축키
          </DialogTitle>
          <DialogDescription>
            자주 사용하는 기능의 단축키를 확인하세요
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <React.Fragment key={keyIndex}>
                    {keyIndex > 0 && (
                      <span className="text-muted-foreground">+</span>
                    )}
                    <kbd className="pointer-events-none inline-flex h-7 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-sm font-medium text-muted-foreground">
                      {key}
                    </kbd>
                  </React.Fragment>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

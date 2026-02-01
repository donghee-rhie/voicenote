import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Keyboard } from 'lucide-react';

interface ShortcutHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const shortcuts = [
  {
    keys: isMac ? ['Cmd', 'Shift', 'R'] : ['Ctrl', 'Shift', 'R'],
    description: '녹음 시작/중지 토글',
    category: '녹음',
  },
  {
    keys: isMac ? ['Cmd', 'Shift', 'C'] : ['Ctrl', 'Shift', 'C'],
    description: '마지막 텍스트 복사',
    category: '편집',
  },
  {
    keys: isMac ? ['Cmd', 'Shift', 'Q'] : ['Ctrl', 'Shift', 'Q'],
    description: '창 표시/숨김 토글',
    category: '창',
  },
  {
    keys: ['Esc'],
    description: '취소/닫기',
    category: '일반',
  },
  {
    keys: ['Shift', '?'],
    description: '단축키 도움말 표시',
    category: '일반',
  },
];

const categories = ['녹음', '편집', '창', '일반'];

export function ShortcutHelp({ open, onOpenChange }: ShortcutHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            키보드 단축키
          </DialogTitle>
          <DialogDescription>
            VoiceNote 앱에서 사용할 수 있는 단축키 목록입니다.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {categories.map((category) => {
            const categoryShortcuts = shortcuts.filter(s => s.category === category);
            if (categoryShortcuts.length === 0) return null;
            
            return (
              <div key={category}>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  {category}
                </h4>
                <div className="space-y-3">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border rounded shadow-sm">
                              {key}
                            </kbd>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          {isMac ? 'macOS에서는 Ctrl 대신 Cmd를 사용합니다' : 'Windows/Linux에서는 Ctrl 키를 사용합니다'}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React from 'react';
import { themes, applyTheme, getStoredTheme, ThemeId } from '../lib/themes';
import { Label } from './ui/label';
import { cn } from '../lib/utils';
import { Check } from 'lucide-react';

interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const [currentTheme, setCurrentTheme] = React.useState<ThemeId>(getStoredTheme());

  const handleThemeChange = (themeId: ThemeId) => {
    applyTheme(themeId);
    setCurrentTheme(themeId);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <Label>테마 선택</Label>
      <div className="grid grid-cols-3 gap-3">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => handleThemeChange(theme.id)}
            className={cn(
              'relative flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all hover:border-primary/50',
              currentTheme === theme.id
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card'
            )}
          >
            {/* Theme Preview */}
            <div
              className="h-12 w-full rounded-md flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: theme.preview.bg }}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: theme.preview.accent }}
              />
              <div
                className="ml-2 h-1.5 w-8 rounded-full opacity-50"
                style={{ backgroundColor: theme.preview.accent }}
              />
            </div>

            {/* Theme Name */}
            <span className="text-xs font-medium">{theme.name}</span>

            {/* Selected Indicator */}
            {currentTheme === theme.id && (
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {themes.find((t) => t.id === currentTheme)?.description}
      </p>
    </div>
  );
}

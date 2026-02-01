/**
 * Theme definitions for VoiceNote
 */

export type ThemeId = 'zinc' | 'ocean' | 'purple' | 'light' | 'rose' | 'mint';

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  preview: {
    bg: string;
    accent: string;
  };
  variables: Record<string, string>;
}

export const themes: Theme[] = [
  {
    id: 'zinc',
    name: 'Zinc Dark',
    description: '미니멀하고 모던한 회색 계열 테마',
    preview: {
      bg: '#0a0a0a',
      accent: '#fafafa',
    },
    variables: {
      '--background': '240 10% 3.9%',
      '--foreground': '0 0% 98%',
      '--card': '240 10% 3.9%',
      '--card-foreground': '0 0% 98%',
      '--popover': '240 10% 3.9%',
      '--popover-foreground': '0 0% 98%',
      '--primary': '0 0% 98%',
      '--primary-foreground': '240 5.9% 10%',
      '--secondary': '240 3.7% 15.9%',
      '--secondary-foreground': '0 0% 98%',
      '--muted': '240 3.7% 15.9%',
      '--muted-foreground': '240 5% 64.9%',
      '--accent': '240 3.7% 15.9%',
      '--accent-foreground': '0 0% 98%',
      '--destructive': '0 62.8% 30.6%',
      '--destructive-foreground': '0 0% 98%',
      '--border': '240 3.7% 15.9%',
      '--input': '240 3.7% 15.9%',
      '--ring': '240 4.9% 83.9%',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    description: '차분하고 깊은 네이비 블루 테마',
    preview: {
      bg: '#0c1222',
      accent: '#38bdf8',
    },
    variables: {
      '--background': '222 47% 8%',
      '--foreground': '210 40% 98%',
      '--card': '222 47% 8%',
      '--card-foreground': '210 40% 98%',
      '--popover': '222 47% 10%',
      '--popover-foreground': '210 40% 98%',
      '--primary': '199 89% 48%',
      '--primary-foreground': '222 47% 8%',
      '--secondary': '217 33% 17%',
      '--secondary-foreground': '210 40% 98%',
      '--muted': '217 33% 17%',
      '--muted-foreground': '215 20% 65%',
      '--accent': '199 89% 48%',
      '--accent-foreground': '222 47% 8%',
      '--destructive': '0 63% 31%',
      '--destructive-foreground': '210 40% 98%',
      '--border': '217 33% 20%',
      '--input': '217 33% 17%',
      '--ring': '199 89% 48%',
    },
  },
  {
    id: 'purple',
    name: 'Purple Night',
    description: '세련된 보라색 포인트의 프리미엄 테마',
    preview: {
      bg: '#0f0a1a',
      accent: '#a855f7',
    },
    variables: {
      '--background': '270 50% 5%',
      '--foreground': '0 0% 98%',
      '--card': '270 50% 5%',
      '--card-foreground': '0 0% 98%',
      '--popover': '270 50% 7%',
      '--popover-foreground': '0 0% 98%',
      '--primary': '270 91% 65%',
      '--primary-foreground': '270 50% 5%',
      '--secondary': '270 30% 15%',
      '--secondary-foreground': '0 0% 98%',
      '--muted': '270 30% 15%',
      '--muted-foreground': '270 10% 60%',
      '--accent': '270 91% 65%',
      '--accent-foreground': '270 50% 5%',
      '--destructive': '0 63% 31%',
      '--destructive-foreground': '0 0% 98%',
      '--border': '270 30% 18%',
      '--input': '270 30% 15%',
      '--ring': '270 91% 65%',
    },
  },
  {
    id: 'light',
    name: 'Snow White',
    description: '깔끔하고 밝은 라이트 테마',
    preview: {
      bg: '#fafafa',
      accent: '#18181b',
    },
    variables: {
      '--background': '0 0% 100%',
      '--foreground': '240 10% 3.9%',
      '--card': '0 0% 100%',
      '--card-foreground': '240 10% 3.9%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '240 10% 3.9%',
      '--primary': '240 5.9% 10%',
      '--primary-foreground': '0 0% 98%',
      '--secondary': '240 4.8% 95.9%',
      '--secondary-foreground': '240 5.9% 10%',
      '--muted': '240 4.8% 95.9%',
      '--muted-foreground': '240 3.8% 46.1%',
      '--accent': '240 4.8% 95.9%',
      '--accent-foreground': '240 5.9% 10%',
      '--destructive': '0 84.2% 60.2%',
      '--destructive-foreground': '0 0% 98%',
      '--border': '240 5.9% 90%',
      '--input': '240 5.9% 90%',
      '--ring': '240 5.9% 10%',
    },
  },
  {
    id: 'rose',
    name: 'Rose Petal',
    description: '따뜻하고 부드러운 로즈 라이트 테마',
    preview: {
      bg: '#fff5f5',
      accent: '#e11d48',
    },
    variables: {
      '--background': '0 0% 100%',
      '--foreground': '350 30% 15%',
      '--card': '0 50% 99%',
      '--card-foreground': '350 30% 15%',
      '--popover': '0 50% 99%',
      '--popover-foreground': '350 30% 15%',
      '--primary': '347 77% 50%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '350 50% 96%',
      '--secondary-foreground': '350 30% 20%',
      '--muted': '350 30% 95%',
      '--muted-foreground': '350 15% 45%',
      '--accent': '347 77% 50%',
      '--accent-foreground': '0 0% 100%',
      '--destructive': '0 84% 60%',
      '--destructive-foreground': '0 0% 98%',
      '--border': '350 30% 90%',
      '--input': '350 30% 90%',
      '--ring': '347 77% 50%',
    },
  },
  {
    id: 'mint',
    name: 'Mint Fresh',
    description: '상쾌하고 시원한 민트 라이트 테마',
    preview: {
      bg: '#f0fdf4',
      accent: '#10b981',
    },
    variables: {
      '--background': '0 0% 100%',
      '--foreground': '160 30% 12%',
      '--card': '150 50% 99%',
      '--card-foreground': '160 30% 12%',
      '--popover': '150 50% 99%',
      '--popover-foreground': '160 30% 12%',
      '--primary': '160 84% 39%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '150 40% 95%',
      '--secondary-foreground': '160 30% 18%',
      '--muted': '150 25% 94%',
      '--muted-foreground': '160 15% 42%',
      '--accent': '160 84% 39%',
      '--accent-foreground': '0 0% 100%',
      '--destructive': '0 84% 60%',
      '--destructive-foreground': '0 0% 98%',
      '--border': '150 25% 88%',
      '--input': '150 25% 88%',
      '--ring': '160 84% 39%',
    },
  },
];

export function getThemeById(id: ThemeId): Theme | undefined {
  return themes.find((t) => t.id === id);
}

export function applyTheme(themeId: ThemeId): void {
  const theme = getThemeById(themeId);
  if (!theme) return;

  const root = document.documentElement;
  Object.entries(theme.variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // Set color-scheme for light themes
  const lightThemes: ThemeId[] = ['light', 'rose', 'mint'];
  if (lightThemes.includes(themeId)) {
    root.style.setProperty('color-scheme', 'light');
  } else {
    root.style.setProperty('color-scheme', 'dark');
  }

  // Save to localStorage
  localStorage.setItem('voicenote-theme', themeId);
}

export function getStoredTheme(): ThemeId {
  const stored = localStorage.getItem('voicenote-theme');
  if (stored && themes.some((t) => t.id === stored)) {
    return stored as ThemeId;
  }
  return 'zinc'; // Default theme
}

export function initializeTheme(): void {
  const themeId = getStoredTheme();
  applyTheme(themeId);
}

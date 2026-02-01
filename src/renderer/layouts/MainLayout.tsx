import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, Settings, Shield, LogOut, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { cn } from '../lib/utils';
import { useToast } from '../components/ui/use-toast';
import { ShortcutHelp } from '../components/ShortcutHelp';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  requireAdmin?: boolean;
}

const navItems: NavItem[] = [
  { label: '대시보드', path: '/dashboard', icon: <Home className="w-5 h-5" /> },
  { label: '세션', path: '/sessions', icon: <FileText className="w-5 h-5" /> },
  { label: '설정', path: '/settings', icon: <Settings className="w-5 h-5" /> },
  { label: '관리자', path: '/admin', icon: <Shield className="w-5 h-5" />, requireAdmin: true },
];

// 마지막 세션 텍스트 저장용 (클립보드 복사용)
let lastSessionText: string = '';

export function setLastSessionText(text: string) {
  lastSessionText = text;
}

export function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const { toast } = useToast();

  // 입력 필드 포커스 체크
  const isInputFocused = useCallback(() => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;
    
    const tagName = activeElement.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      (activeElement as HTMLElement).isContentEditable
    );
  }, []);

  // Listen for global shortcuts from main process
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubscribeRecording = window.electronAPI.on('shortcut:recording-toggle', () => {
      // 입력 필드 포커스 시 단축키 무시
      if (isInputFocused()) {
        return;
      }
      
      console.log('[MainLayout] Recording toggle shortcut received');
      
      // 백그라운드 녹음 지원 - 대시보드로 이동하지 않음
      // 단, 녹음 상태 관리가 대시보드에서만 가능하므로, 
      // 현재 대시보드가 아니면 이동
      if (location.pathname !== '/dashboard') {
        navigate('/dashboard');
      }
      // Dispatch custom event for RecordingPanel to handle
      window.dispatchEvent(new CustomEvent('toggle-recording'));
    });

    const unsubscribePaste = window.electronAPI.on('shortcut:paste-from-clipboard', async () => {
      // 입력 필드 포커스 시 단축키 무시
      if (isInputFocused()) {
        return;
      }
      
      if (lastSessionText) {
        try {
          await window.electronAPI.invoke('system:clipboard-copy', lastSessionText);
          toast({
            title: '복사됨',
            description: '마지막 텍스트가 클립보드에 복사되었습니다',
          });
        } catch (err) {
          toast({
            title: '복사 실패',
            description: '클립보드 복사에 실패했습니다',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: '복사할 텍스트 없음',
          description: '먼저 녹음을 완료해주세요',
          variant: 'destructive',
        });
      }
    });

    return () => {
      unsubscribeRecording();
      unsubscribePaste();
    };
  }, [navigate, location.pathname, toast, isInputFocused]);

  // 키보드 단축키 (Shift+? 도움말)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 필드 포커스 시 무시 (Escape 제외)
      if (isInputFocused() && e.key !== 'Escape') {
        return;
      }

      // Shift+? = 도움말
      if (e.shiftKey && e.key === '?') {
        e.preventDefault();
        setShowShortcutHelp(prev => !prev);
      }

      // Escape = 닫기
      if (e.key === 'Escape') {
        setShowShortcutHelp(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInputFocused]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return '관리자';
    const item = navItems.find(item => item.path === path);
    return item?.label || 'VoiceNote';
  };

  const filteredNavItems = navItems.filter(
    item => !item.requireAdmin || user?.role === 'ADMIN'
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo & Toggle */}
        <div className="h-14 flex items-center justify-between px-4 border-b">
          {!collapsed && <span className="font-bold text-lg">VoiceNote</span>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(collapsed && 'mx-auto')}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path ||
                           (item.path === '/admin' && location.pathname.startsWith('/admin'));

            return (
              <Button
                key={item.path}
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  collapsed && 'justify-center px-2'
                )}
                onClick={() => navigate(item.path)}
              >
                {item.icon}
                {!collapsed && <span className="ml-3">{item.label}</span>}
              </Button>
            );
          })}
        </nav>

        {/* Help Button */}
        <div className="p-2">
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start',
              collapsed && 'justify-center px-2'
            )}
            onClick={() => setShowShortcutHelp(true)}
          >
            <HelpCircle className="w-5 h-5" />
            {!collapsed && <span className="ml-3">단축키 (Shift+?)</span>}
          </Button>
        </div>

        {/* User Info & Logout */}
        <div className="p-2 border-t">
          {!collapsed && user && (
            <div className="mb-2 px-2 py-2">
              <div className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10',
              collapsed && 'justify-center px-2'
            )}
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="ml-3">로그아웃</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 flex items-center px-6 border-b bg-card">
          <h1 className="text-xl font-semibold">{getPageTitle()}</h1>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Shortcut Help Modal */}
      <ShortcutHelp open={showShortcutHelp} onOpenChange={setShowShortcutHelp} />
    </div>
  );
}

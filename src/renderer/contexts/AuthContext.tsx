import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 기본 로컬 사용자 (로그인 없이 사용)
const DEFAULT_USER: User = {
  id: 'local-user',
  email: 'local@voicenote.app',
  name: '사용자',
  role: 'ADMIN',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // 항상 기본 사용자로 로그인된 상태
  const [user, setUser] = useState<User | null>(DEFAULT_USER);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 항상 기본 사용자 사용
    if (!user) {
      setUser(DEFAULT_USER);
    }
  }, [user]);

  const login = async (email: string, password: string) => {
    try {
      const result = await window.electronAPI.invoke('user:login', { email, password });

      if (result.success && result.data) {
        const userData: User = {
          id: result.data.id,
          email: result.data.email,
          name: result.data.name,
          role: result.data.role,
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

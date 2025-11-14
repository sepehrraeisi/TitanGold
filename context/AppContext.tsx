import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { User } from '../types.ts';

type Theme = 'light' | 'dark';

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setThemeState] = useState<Theme>('dark');
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState('https://i.pravatar.cc/40?u=traderone'); // Default avatar

  useEffect(() => {
    const storedTheme = localStorage.getItem('titan_theme') as Theme;
    if (storedTheme) {
      setThemeState(storedTheme);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('titan_theme', newTheme);
  };

  const toggleDemoMode = () => {
    setIsDemoMode(prev => !prev);
  };

  return (
    <AppContext.Provider value={{ user, setUser, theme, setTheme, isDemoMode, toggleDemoMode, avatarUrl, setAvatarUrl }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
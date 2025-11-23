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
  const [avatarUrl, setAvatarUrlState] = useState('https://i.pravatar.cc/40?u=traderone');

  useEffect(() => {
    // Load user from storage on mount
    const loadUser = () => {
        try {
            let userData = sessionStorage.getItem('titan_user');
            if (!userData) {
                userData = localStorage.getItem('titan_user');
            }
            
            if (userData) {
                const user = JSON.parse(userData);
                setUser(user);
                sessionStorage.setItem('titan_user', userData);
                localStorage.setItem('titan_user', userData);
            }
        } catch (e) {
            console.warn('Failed to load user from storage:', e);
        }
    };
    
    loadUser();

    // Listen for user updates
    const handleUserUpdate = () => {
        loadUser();
    };

    window.addEventListener('titan_user_updated', handleUserUpdate);
    
    return () => {
        window.removeEventListener('titan_user_updated', handleUserUpdate);
    };
  }, []);

  // Listen for avatar updates
  useEffect(() => {
    const handleAvatarUpdate = () => {
        try {
            const profileData = localStorage.getItem('titan_profile_settings');
            if (profileData) {
                const parsed = JSON.parse(profileData);
                if (parsed.profile?.avatarUrl && parsed.profile.avatarUrl.startsWith('data:image')) {
                    setAvatarUrlState(parsed.profile.avatarUrl);
                }
            }
        } catch (e) {
            console.warn('Failed to parse profile data:', e);
        }
    };

    window.addEventListener('titan_avatar_updated', handleAvatarUpdate);
    
    // Also listen for localStorage changes (in case of multiple tabs)
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'titan_profile_settings' && e.newValue) {
            try {
                const parsed = JSON.parse(e.newValue);
                if (parsed.profile?.avatarUrl && parsed.profile.avatarUrl.startsWith('data:image')) {
                    setAvatarUrlState(parsed.profile.avatarUrl);
                }
            } catch (e) {
                console.warn('Failed to parse profile data from storage event:', e);
            }
        }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('titan_avatar_updated', handleAvatarUpdate);
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const setAvatarUrl = (url: string) => {
    setAvatarUrlState(url);
    // Also save to localStorage for persistence
    try {
        const profileData = localStorage.getItem('titan_profile_settings');
        if (profileData) {
            const parsed = JSON.parse(profileData);
            if (parsed.profile) {
                parsed.profile.avatarUrl = url;
                localStorage.setItem('titan_profile_settings', JSON.stringify(parsed));
            } else {
                // Create profile structure if it doesn't exist
                const newProfileData = {
                    profile: { avatarUrl: url },
                    communications: {},
                    metrics: [],
                    integrations: [],
                    activity: [],
                    lastUpdated: new Date().toISOString(),
                };
                localStorage.setItem('titan_profile_settings', JSON.stringify(newProfileData));
            }
        } else {
            // Create new profile data if it doesn't exist
            const newProfileData = {
                profile: { avatarUrl: url },
                communications: {},
                metrics: [],
                integrations: [],
                activity: [],
                lastUpdated: new Date().toISOString(),
            };
            localStorage.setItem('titan_profile_settings', JSON.stringify(newProfileData));
        }
        
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('titan_avatar_updated'));
    } catch (e) {
        console.warn('Failed to save avatar to localStorage:', e);
    }
  };

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
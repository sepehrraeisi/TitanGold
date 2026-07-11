import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './components/Dashboard.tsx';
import Login from './components/Login.tsx';
import { LanguageProvider } from './context/LanguageContext.tsx';
import { AppProvider, useAppContext } from './context/AppContext.tsx';
import { checkSession, login } from './services/api.ts';
import { loginWithBackend, checkSessionStorage, logoutUser } from './services/api-auth.ts';
import LoadingScreen from './components/LoadingScreen.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { PreferencesMigrationManager } from './components/PreferencesMigration.tsx';
import { FavoritesMigrationManager } from './components/FavoritesMigration.tsx';
import type { User } from './types.ts';
import { database } from './services/database.ts';

const AppContent: React.FC = () => {
  const { user, setUser, theme } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize database
    database.init().catch(console.error);
  }, []);

  useEffect(() => {
    // Standard theme switching by toggling a class on the root element
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  useEffect(() => {
    const validateSession = async () => {
      // Try to check session from backend token
      const sessionUser = await checkSessionStorage();
      if (sessionUser) {
        console.log('✅ Session restored:', sessionUser);
        setUser(sessionUser);
      } else {
        console.log('⚠️ No session found');

        // Development fallback: Auto-login with mock user in dev mode
        // This helps during frontend development when backend is not available
        if (import.meta.env.DEV && window.location.search.includes('dev-login')) {
          console.warn('🔧 Development mode: Auto-login enabled via ?dev-login');
          const mockUser: User = {
            id: 'dev-user-auto',
            name: 'Development User',
            email: 'dev@local.dev',
            username: 'dev',
            role: 'Admin' as const,
          };
          sessionStorage.setItem('titan_user', JSON.stringify(mockUser));
          localStorage.setItem('titan_user', JSON.stringify(mockUser));
          setUser(mockUser);
        }
      }
      setIsLoading(false);
    };
    validateSession();
  }, [setUser]);

  useEffect(() => {
    const handleAuthExpired = () => {
      logoutUser();
      setUser(null);
    };

    window.addEventListener('titan_auth_expired', handleAuthExpired);
    return () => window.removeEventListener('titan_auth_expired', handleAuthExpired);
  }, [setUser]);

  const handleLogin = async (username: string, pass: string) => {
    setAuthError(null);
    console.log('🔐 Attempting login with backend API...');

    // Use real backend API for login
    const loggedInUser = await loginWithBackend(username, pass);

    if (loggedInUser) {
      console.log('✅ Login successful, user:', loggedInUser);
      setUser(loggedInUser);
    } else {
      // Development fallback: If backend is not available, use mock user
      // This only works in development mode and when backend is unreachable
      if (import.meta.env.DEV) {
        console.warn('⚠️ Backend login failed, using development fallback');
        console.warn('💡 This is a temporary development mode. Backend connection is required in production.');

        // Create a mock user for development
        const mockUser: User = {
          id: 'dev-user-' + Date.now(),
          name: username || 'Development User',
          email: `${username}@dev.local`,
          username: username || 'dev',
          role: 'Admin' as const,
        };

        // Store mock user in session
        sessionStorage.setItem('titan_user', JSON.stringify(mockUser));
        localStorage.setItem('titan_user', JSON.stringify(mockUser));
        sessionStorage.setItem('titan_token', 'dev-token-' + Date.now());
        localStorage.setItem('titan_token', 'dev-token-' + Date.now());

        console.log('✅ Development mode: Mock user created', mockUser);
        setUser(mockUser);
      } else {
        console.error('❌ Login failed');
        setAuthError('invalid_credentials');
      }
    }
  };

  const handleLogout = () => {
    console.log('👋 Logging out...');
    logoutUser(); // Clear session storage
    setUser(null);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen">
      {user ? (
        <PreferencesMigrationManager>
          <FavoritesMigrationManager>
            <Dashboard onLogout={handleLogout} />
          </FavoritesMigrationManager>
        </PreferencesMigrationManager>
      ) : (
        <Login onLogin={handleLogin} errorKey={authError} />
      )}
    </div>
  );
};


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AppProvider>
            <AppContent />
          </AppProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
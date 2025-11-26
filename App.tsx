import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard.tsx';
import Login from './components/Login.tsx';
import { LanguageProvider } from './context/LanguageContext.tsx';
import { AppProvider, useAppContext } from './context/AppContext.tsx';
import { checkSession, login } from './services/api.ts';
import { loginWithBackend, checkSessionStorage, logoutUser } from './services/api-auth.ts';
import LoadingScreen from './components/LoadingScreen.tsx';
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
      }
      setIsLoading(false);
    };
    validateSession();
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
      console.error('❌ Login failed');
      setAuthError('invalid_credentials');
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
      {user ? <Dashboard onLogout={handleLogout} /> : <Login onLogin={handleLogin} errorKey={authError} />}
    </div>
  );
};


const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </LanguageProvider>
  );
};

export default App;
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import * as api from '../services/api.ts';

interface LoginProps {
  onLogin: (username: string, pass: string) => void;
  errorKey: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, errorKey }) => {
  const { t } = useLanguage();
  const [username, setUsername] = useState('reza_farhadi');
  const [password, setPassword] = useState('tradeSecure1');
  const [showRegister, setShowRegister] = useState(false);
  const [registerData, setRegisterData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  useEffect(() => {
    const checkRegistration = async () => {
      try {
        const settings = await api.fetchUserManagement();
        console.log('Registration status checked:', settings.registrationEnabled);
        setRegistrationEnabled(settings.registrationEnabled);
      } catch (e) {
        console.warn('Failed to check registration status:', e);
      }
    };
    
    // Check on mount
    checkRegistration();
    
    // Listen for storage changes (when registration is toggled in Settings)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'titan_user_management') {
        console.log('Storage change detected for user_management');
        checkRegistration();
      }
    };
    
    // Listen for custom events (when registration is toggled in Settings)
    const handleRegistrationToggle = (e: Event) => {
      console.log('Registration toggle event received:', e);
      checkRegistration();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('titan_registration_toggled', handleRegistrationToggle);
    
    // Also check periodically (every 2 seconds) as a fallback
    const interval = setInterval(checkRegistration, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('titan_registration_toggled', handleRegistrationToggle);
      clearInterval(interval);
    };
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registerData.password !== registerData.confirmPassword) {
      // Show error
      return;
    }
    
    setIsRegistering(true);
    try {
      const result = await api.registerNewUser({
        name: registerData.name,
        email: registerData.email,
        password: registerData.password,
      });
      
      if (result.success) {
        // Show success message and switch to login
        setShowRegister(false);
        // Pre-fill username with email prefix for easier login
        const username = registerData.email.split('@')[0];
        setUsername(username);
        setRegisterData({ name: '', email: '', password: '', confirmPassword: '' });
        // Show success message
        alert(t('registration_success_message') || 'Registration successful! You can now login.');
      } else {
        // Show error message
        alert(t(result.message) || 'Registration failed. Please try again.');
      }
    } catch (err) {
      // Show error
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm p-8 space-y-8 bg-card rounded-xl shadow-2xl border border-border">
        <div className="text-center">
            <svg className="mx-auto h-10 w-auto text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-foreground">{t('login_welcome')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('login_subtitle')}</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">{t('login_username')}</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm rounded-md"
                placeholder={t('login_username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">{t('login_password')}</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm rounded-md"
                placeholder={t('login_password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          
          {errorKey && <p className="text-sm text-red-400 text-center">{t(errorKey)}</p>}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-primary transition-colors"
            >
              {t('login_button')}
            </button>
          </div>
        </form>
        
        {registrationEnabled && (
          <div className="text-center">
            <button
              onClick={() => setShowRegister(!showRegister)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {showRegister ? t('back_to_login') : t('create_account')}
            </button>
          </div>
        )}

        {showRegister && registrationEnabled && (
          <form className="mt-4 space-y-4" onSubmit={handleRegister}>
            <div>
              <label htmlFor="registerName" className="sr-only">{t('full_name')}</label>
              <input
                id="registerName"
                name="registerName"
                type="text"
                autoComplete="name"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm rounded-md"
                placeholder={t('full_name')}
                value={registerData.name}
                onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="registerEmail" className="sr-only">{t('email_address')}</label>
              <input
                id="registerEmail"
                name="registerEmail"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm rounded-md"
                placeholder={t('email_address')}
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="registerPassword" className="sr-only">{t('password')}</label>
              <input
                id="registerPassword"
                name="registerPassword"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm rounded-md"
                placeholder={t('password')}
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="registerConfirmPassword" className="sr-only">{t('confirm_password')}</label>
              <input
                id="registerConfirmPassword"
                name="registerConfirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm rounded-md"
                placeholder={t('confirm_password')}
                value={registerData.confirmPassword}
                onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={isRegistering}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegistering ? t('registering') : t('register')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
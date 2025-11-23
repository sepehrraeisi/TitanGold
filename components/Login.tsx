import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import * as api from '../services/api.ts';
import { registerWithBackend, getSetting } from '../services/api-auth.ts';

interface LoginProps {
  onLogin: (username: string, pass: string) => void;
  errorKey: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, errorKey }) => {
  const { t } = useLanguage();
  const [username, setUsername] = useState('admin');  // Changed to existing backend user
  const [password, setPassword] = useState('Admin123!');  // Changed to existing backend password
  const [showRegister, setShowRegister] = useState(false);
  const [registerData, setRegisterData] = useState({ name: '', username: '', email: '', password: '', confirmPassword: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);  // Default to false, fetch from backend
  const [isCheckingSettings, setIsCheckingSettings] = useState(true);

  // Check registration status from backend
  useEffect(() => {
    const checkRegistrationStatus = async () => {
      setIsCheckingSettings(true);
      try {
        console.log('🔄 Checking registration status from backend...');
        const enabled = await getSetting('public_registration');
        
        if (enabled !== null) {
          console.log('✅ Registration status from backend:', enabled);
          setRegistrationEnabled(enabled === true || enabled === 'true');
        } else {
          console.warn('⚠️ Could not fetch registration status, defaulting to false');
          setRegistrationEnabled(false);
        }
      } catch (error) {
        console.error('❌ Error checking registration status:', error);
        setRegistrationEnabled(false);
      } finally {
        setIsCheckingSettings(false);
      }
    };
    
    checkRegistrationStatus();
    
    // Check every 5 seconds in case settings change
    const interval = setInterval(checkRegistrationStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registerData.password !== registerData.confirmPassword) {
      alert(t('password_mismatch') || 'Passwords do not match!');
      return;
    }
    
    setIsRegistering(true);
    try {
      console.log('📝 Registering with backend API...');
      
      // Use real backend API for registration
      const newUser = await registerWithBackend(
        registerData.email,
        registerData.username || registerData.email.split('@')[0],
        registerData.password,
        registerData.name
      );
      
      if (newUser) {
        // Show success message and switch to login
        console.log('✅ Registration successful:', newUser);
        setShowRegister(false);
        setUsername(newUser.username);
        setRegisterData({ name: '', username: '', email: '', password: '', confirmPassword: '' });
        alert(t('registration_success_message') || 'Registration successful! You can now login.');
      } else {
        console.error('❌ Registration failed');
        alert(t('registration_failed') || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('💥 Registration error:', err);
      alert(t('registration_error') || 'An error occurred during registration.');
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
        
        {/* Login Form - Only show when NOT in register mode */}
        {!showRegister && (
          <>
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
                  onClick={() => setShowRegister(true)}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {t('create_account')}
                </button>
              </div>
            )}
          </>
        )}

        {/* Registration Form - Only show when in register mode */}
        {showRegister && registrationEnabled && (
          <>
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
                placeholder={t('full_name') || 'Full Name'}
                value={registerData.name}
                onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="registerUsername" className="sr-only">{t('username') || 'Username'}</label>
              <input
                id="registerUsername"
                name="registerUsername"
                type="text"
                autoComplete="username"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm rounded-md"
                placeholder={t('username') || 'Username'}
                value={registerData.username}
                onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
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
                placeholder={t('email_address') || 'Email Address'}
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
          
          <div className="text-center">
            <button
              onClick={() => setShowRegister(false)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {t('back_to_login')}
            </button>
          </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
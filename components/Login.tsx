import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';

interface LoginProps {
  onLogin: (username: string, pass: string) => void;
  errorKey: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, errorKey }) => {
  const { t } = useLanguage();
  const [username, setUsername] = useState('trader_one');
  const [password, setPassword] = useState('password123');


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0D111C]">
      <div className="w-full max-w-sm p-8 space-y-8 bg-[#161B22] rounded-xl shadow-2xl border border-gray-800">
        <div className="text-center">
            <svg className="mx-auto h-10 w-auto text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-white">{t('login_welcome')}</h2>
          <p className="mt-2 text-sm text-gray-400">{t('login_subtitle')}</p>
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
                className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-[#0D111C] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm rounded-md"
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
                className="appearance-none relative block w-full px-3 py-3 border border-gray-700 bg-[#0D111C] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm rounded-md"
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
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 transition-colors"
            >
              {t('login_button')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
import React, { useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { ViewKey, NavigationPayload, NavigationTarget, OnNavigateHandler } from '../types/navigation.ts';
import TradingDashboardHome from './trading/TradingDashboardHome.tsx';
import Favorites from './Favorites.tsx';
import Trades from './Trades.tsx';
import Portfolio from './Portfolio.tsx';
import Analysis from './Analysis.tsx';
import News from './News.tsx';
import Settings from './Settings.tsx';
import AICenter from './AICenter.tsx';
import ProfilePage from './ProfilePage.tsx';
import GoldPage from './GoldPage.tsx';
import Chatbot from './Chatbot.tsx';
import WalletManagement from './WalletManagement.tsx';
import Header from './Header.tsx';
import Button from './ui/button.tsx';

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const { language } = useLanguage();
  const [activeView, setActiveView] = useState<ViewKey>('dashboard');
  const [navigationPayload, setNavigationPayload] = useState<NavigationPayload | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Smart navigation handler that accepts both string and payload
  const handleNavigation: OnNavigateHandler = (target) => {
    if (typeof target === 'string') {
      setActiveView(target);
      setNavigationPayload(null);
    } else {
      setActiveView(target.view);
      setNavigationPayload(target);
    }
  };

  const navItems = useMemo(
    () => [
      { key: 'dashboard' as ViewKey, icon: '📊', label: { en: 'Dashboard', fa: 'داشبورد' } },
      { key: 'portfolio' as ViewKey, icon: '💼', label: { en: 'Portfolio', fa: 'پورتفولیو' } },
      { key: 'trades' as ViewKey, icon: '⚡️', label: { en: 'Trades', fa: 'معاملات' } },
      { key: 'favorites' as ViewKey, icon: '⭐️', label: { en: 'Watchlist', fa: 'لیست دلخواه' } },
      { key: 'wallet' as ViewKey, icon: '💼', label: { en: 'Wallet', fa: 'کیف پول' } },
      { key: 'analysis' as ViewKey, icon: '🧠', label: { en: 'Analysis', fa: 'تحلیل' } },
      { key: 'ai' as ViewKey, icon: '🤖', label: { en: 'AI Center', fa: 'مرکز هوش مصنوعی' } },
      { key: 'news' as ViewKey, icon: '📰', label: { en: 'News', fa: 'اخبار' } },
      { key: 'gold' as ViewKey, icon: '🥇', label: { en: 'Gold Market', fa: 'بازار طلا' } },
      { key: 'settings' as ViewKey, icon: '⚙️', label: { en: 'Settings', fa: 'تنظیمات' } },
    ],
    [language]
  );

  const renderView = () => {
    switch (activeView) {
      case 'favorites':
        return <Favorites setActiveView={setActiveView} />;
      case 'trades':
        return <Trades />;
      case 'portfolio':
        return <Portfolio />;
      case 'wallet':
        return <WalletManagement />;
      case 'analysis':
        return <Analysis />;
      case 'news':
        return <News />;
      case 'ai':
        return <AICenter onNavigate={handleNavigation} />;
      case 'gold':
        return <GoldPage />;
      case 'settings':
        return <Settings 
          initialTab={navigationPayload?.settingsTab} 
          initialSubtab={navigationPayload?.settingsSubtab}
          onNavigationComplete={() => setNavigationPayload(null)}
        />;
      case 'profile':
        return <ProfilePage />;
      case 'dashboard':
      default:
        return <TradingDashboardHome />;
    }
  };

  const dir = language === 'fa' ? 'rtl' : 'ltr';

  return (
    <div 
      className={`min-h-screen bg-background text-foreground ${dir}`} 
      dir={dir}
      style={language === 'fa' ? { fontFamily: 'IRANSans, Vazir, Tahoma, sans-serif' } : {}}
    >
      <div className="relative flex h-screen w-full overflow-hidden">
        <div className="flex h-full w-full flex-col">
          <Header 
            activeView={activeView} 
            setActiveView={setActiveView} 
            onLogout={onLogout}
          />
            <main className="flex-1 overflow-y-auto bg-background px-4 py-6 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-7xl">
                {renderView()}
              </div>
          </main>
        </div>

        {isMobileNavOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur" onClick={() => setMobileNavOpen(false)}>
            <div
              className="absolute top-0 h-full w-64 bg-background p-6 text-sm text-muted-foreground"
              style={language === 'fa' ? { right: 0 } : { left: 0 }}
              onClick={event => event.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="text-lg font-semibold">TITAN</span>
                <button onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="space-y-2">
                {navItems.map(item => (
                  <button
                    key={item.key}
                    onClick={() => {
                      handleNavigation(item.key);
                      setMobileNavOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 ${
                      activeView === item.key ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span>{item.icon}</span>
                      <span>{item.label[language]}</span>
                    </span>
                  </button>
                ))}
              </nav>
              <div className="mt-8 border-t border-border pt-4">
                <Button variant="outline" className="w-full border-border" onClick={onLogout}>
                  {language === 'fa' ? 'خروج' : 'Logout'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Chatbot />
    </div>
  );
};

export default Dashboard;

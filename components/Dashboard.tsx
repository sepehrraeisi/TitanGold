import React, { useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useAppContext } from '../context/AppContext.tsx';
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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable.tsx';
import Button from './ui/button.tsx';

interface DashboardProps {
  onLogout: () => void;
}

type ViewKey =
  | 'dashboard'
  | 'favorites'
  | 'trades'
  | 'portfolio'
  | 'analysis'
  | 'news'
  | 'ai'
  | 'gold'
  | 'settings'
  | 'profile'
  | 'wallet';

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const { language } = useLanguage();
  const { user } = useAppContext();
  const [activeView, setActiveView] = useState<ViewKey>('dashboard');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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

  const viewTitle = navItems.find(item => item.key === activeView)?.label ?? { en: '', fa: '' };

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
        return <AICenter />;
      case 'gold':
        return <GoldPage />;
      case 'settings':
        return <Settings />;
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
        <ResizablePanelGroup defaultLayout={[22, 78]} className="hidden h-full w-full md:flex">
          <ResizablePanel index={0} minSize={16} className="hidden md:flex">
            <aside className="flex h-full w-full flex-col border-r border-border bg-card/90 backdrop-blur">
              <div className="flex items-center justify-between border-b border-border px-6 py-5 text-xl font-bold text-foreground">
                <span>TITAN</span>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6 text-sm">
                {navItems.map(item => (
                  <button
                    key={item.key}
                    onClick={() => setActiveView(item.key)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors ${
                      activeView === item.key 
                        ? 'bg-primary/20 text-primary' 
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span>{item.icon}</span>
                      <span>{item.label[language]}</span>
                    </span>
                    {activeView === item.key && (
                      <span className="h-2 w-2 rounded-full bg-blue-400" aria-hidden />
                    )}
                  </button>
                ))}
              </nav>
              <div className="border-t border-border px-4 py-5">
                <Button
                  variant="outline"
                  className="w-full border-border text-muted-foreground hover:text-foreground"
                  onClick={onLogout}
                >
                  {language === 'fa' ? 'خروج' : 'Logout'}
                </Button>
              </div>
            </aside>
          </ResizablePanel>
          <ResizableHandle className="hidden md:flex" />
          <ResizablePanel index={1} className="flex flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-border bg-[#101428]/80 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-3">
                <button
                  className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground md:hidden"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Toggle navigation"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div>
                  <p className="text-sm uppercase tracking-wide text-gray-500">
                    {language === 'fa' ? 'ناحیه' : 'Section'}
                  </p>
                  <h1 className="text-lg font-semibold text-foreground">
                    {language === 'fa' ? viewTitle.fa : viewTitle.en}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button className="relative rounded-md border border-border p-2 text-muted-foreground hover:text-foreground" aria-label="Notifications">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5"
                    />
                  </svg>
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-blue-500" />
                </button>
                <Button variant="primary" className="hidden sm:inline-flex">
                  {language === 'fa' ? 'معامله جدید' : 'New Trade'}
                </Button>
                <div className="relative">
                  <button
                    onClick={() => setIsProfileMenuOpen(prev => !prev)}
                    className="flex items-center gap-2 rounded-md border border-border bg-[#0f1422] px-3 py-1.5 text-sm text-gray-200 hover:text-foreground"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white">
                      {user?.name?.[0] ?? 'U'}
                    </div>
                    <div className="hidden text-left sm:block">
                      <p className="text-sm font-medium text-foreground">{user?.name ?? 'Trader'}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <svg className={`h-4 w-4 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  {isProfileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-[#101528] p-2 shadow-xl">
                      <button
                        onClick={() => {
                          setActiveView('profile');
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
                      >
                        {language === 'fa' ? 'پروفایل' : 'Profile'}
                      </button>
                      <button
                        onClick={() => {
                          setActiveView('settings');
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
                      >
                        {language === 'fa' ? 'تنظیمات' : 'Settings'}
                      </button>
                      <div className="my-1 h-px border-border" />
                      <button
                        onClick={onLogout}
                        className="w-full rounded-md px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20"
                      >
                        {language === 'fa' ? 'خروج' : 'Logout'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto bg-background px-4 py-6 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-7xl">
                {renderView()}
              </div>
            </main>
          </ResizablePanel>
        </ResizablePanelGroup>

        <div className="flex h-full w-full flex-col md:hidden">
          <header className="flex items-center justify-between border-b border-border bg-[#101428]/90 px-4 py-3">
            <button
              className="rounded-md border border-border p-2 text-muted-foreground"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Toggle navigation"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-lg font-semibold">TITAN</span>
            <Button variant="primary" className="text-xs">
              {language === 'fa' ? 'معامله جدید' : 'New Trade'}
            </Button>
          </header>
          <main className="flex-1 overflow-y-auto bg-background px-4 py-6">
            <div className="mx-auto max-w-5xl">{renderView()}</div>
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
                      setActiveView(item.key);
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

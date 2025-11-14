import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import Header from './Header.tsx';
import Chatbot from './Chatbot.tsx';
import DashboardHome from './DashboardHome.tsx';
import Favorites from './Favorites.tsx';
import Trades from './Trades.tsx';
import Portfolio from './Portfolio.tsx';
import Analysis from './Analysis.tsx';
import News from './News.tsx';
import Settings from './Settings.tsx';
import AICenter from './AICenter.tsx';
import ProfilePage from './ProfilePage.tsx';
import GoldPage from './GoldPage.tsx';

interface DashboardProps {
    onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
    const { language } = useLanguage();
    const [activeView, setActiveView] = useState('dashboard');

    const renderView = () => {
        switch (activeView) {
            case 'favorites':
                return <Favorites setActiveView={setActiveView} />;
            case 'trades':
                return <Trades />;
            case 'portfolio':
                return <Portfolio />;
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
                return <DashboardHome />;
        }
    };

    return (
        <div className={`min-h-screen font-sans bg-background text-foreground ${language === 'fa' ? 'rtl' : 'ltr'}`} dir={language === 'fa' ? 'rtl' : 'ltr'}>
            <Header activeView={activeView} setActiveView={setActiveView} onLogout={onLogout} />
            <main className="p-4 sm:p-6 max-w-7xl mx-auto">
                {renderView()}
            </main>
            <Chatbot />
        </div>
    );
};

export default Dashboard;
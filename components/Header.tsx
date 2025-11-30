import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useAppContext } from '../context/AppContext.tsx';
import * as api from '../services/api.ts';
import type { ArtemisState } from '../types.ts';
import { Toast } from './ui/toast.tsx';
import { ConfirmModal } from './ui/confirm-modal.tsx';

interface HeaderProps {
    activeView: string;
    setActiveView: (view: string) => void;
    onLogout: () => void;
}

const NavLink: React.FC<{ text: string; view: string; activeView: string; onClick: (view: string) => void; isMobile?: boolean; }> = ({ text, view, activeView, onClick, isMobile }) => (
    <button
        onClick={() => onClick(view)}
        className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeView === view
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
        } ${isMobile ? 'text-base' : ''}`}
    >
        {text}
    </button>
);

const UserDropdown: React.FC<{setActiveView: (view: string) => void; onLogout: () => void; dailyPnL?: number;}> = ({ setActiveView, onLogout, dailyPnL = 0 }) => {
    const { t } = useLanguage();
    const { user, isDemoMode, toggleDemoMode, avatarUrl } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState(false);

    // Get first letter of user name for fallback
    const getInitials = (name?: string): string => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    };

    // Function to load avatar from all sources
    const loadAvatar = useCallback(() => {
        // Reset error state
        setAvatarError(false);

        // First try avatarUrl from context (most up-to-date)
        if (avatarUrl && avatarUrl.startsWith('data:image')) {
            setCurrentAvatar(avatarUrl);
            return;
        }

        // Then try localStorage
        try {
            const profileData = localStorage.getItem('titan_profile_settings');
            if (profileData) {
                const parsed = JSON.parse(profileData);
                if (parsed.profile?.avatarUrl) {
                    const url = parsed.profile.avatarUrl;
                    // Accept both data:image and http/https URLs
                    if (url.startsWith('data:image') || url.startsWith('http://') || url.startsWith('https://')) {
                        setCurrentAvatar(url);
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to load avatar from localStorage:', e);
        }

        // If no avatar found, set to null to show initials
        setCurrentAvatar(null);
    }, [avatarUrl]);

    // Load avatar on mount and when avatarUrl changes
    useEffect(() => {
        loadAvatar();
    }, [loadAvatar]);

    // Listen for avatar updates
    useEffect(() => {
        const handleAvatarUpdate = () => {
            loadAvatar();
        };

        // Listen for custom event
        window.addEventListener('titan_avatar_updated', handleAvatarUpdate);
        
        // Listen for storage changes (for multi-tab sync)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'titan_profile_settings') {
                loadAvatar();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        // Also check periodically (in case event is missed)
        const interval = setInterval(() => {
            loadAvatar();
        }, 2000); // Check every 2 seconds

        return () => {
            window.removeEventListener('titan_avatar_updated', handleAvatarUpdate);
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [loadAvatar]);

    const handleNavigation = (view: string) => {
        setActiveView(view);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-secondary">
                {currentAvatar && !avatarError ? (
                    <img 
                        className="h-8 w-8 rounded-full object-cover border border-border" 
                        src={currentAvatar} 
                        alt={user?.name || 'User'}
                        onError={() => {
                            console.warn('Avatar image failed to load:', currentAvatar);
                            setAvatarError(true);
                            setCurrentAvatar(null);
                        }}
                    />
                ) : (
                    <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold border border-border">
                        {getInitials(user?.name)}
                    </div>
                )}
                <div className="text-left hidden md:block">
                    <p className="text-sm font-semibold text-foreground">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
                </div>
                {dailyPnL !== 0 && (
                    <div className="text-left hidden lg:block border-l border-border pl-2 ml-2">
                        <p className={`text-sm font-semibold ${dailyPnL >= 0 ? 'text-positive' : 'text-negative'}`}>
                            {dailyPnL >= 0 ? '+' : ''}${dailyPnL.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('today_pnl', { pnl: dailyPnL.toFixed(2) })}</p>
                    </div>
                )}
                <svg className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-md shadow-lg z-50">
                    <button onClick={() => handleNavigation('profile')} className="block text-left w-full px-4 py-2 text-sm text-card-foreground hover:bg-secondary">{t('profile')}</button>
                    <button onClick={() => handleNavigation('settings')} className="block text-left w-full px-4 py-2 text-sm text-card-foreground hover:bg-secondary">{t('settings')}</button>
                    <div className="border-t border-border my-1"></div>
                    <button onClick={onLogout} className="block text-left w-full px-4 py-2 text-sm text-negative hover:bg-negative/10">{t('logout')}</button>
                </div>
            )}
        </div>
    );
}

const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useLanguage();
    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'fa' : 'en');
    }
    return (
        <button onClick={toggleLanguage} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-secondary" title="Switch Language">
            <svg className="h-5 w-5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
            </svg>
        </button>
    )
}

const DemoModeToggle: React.FC = () => {
    const { t } = useLanguage();
    const [artemis, setArtemis] = useState<ArtemisState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isToggling, setIsToggling] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    useEffect(() => {
        const loadArtemis = async () => {
            try {
                const state = await api.fetchArtemisState();
                setArtemis(state);
            } catch (error) {
                console.error('Failed to load Artemis state:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadArtemis();
        
        // Refresh every 10 seconds
        const interval = setInterval(loadArtemis, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isToggling || !artemis) return;
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        if (!artemis) return;
        
        setShowConfirm(false);
        setIsToggling(true);
        
        const newMode = artemis.mode === 'demo' ? 'real' : 'demo';
        
        try {
            const updated = await api.updateArtemisMode(newMode);
            setArtemis(updated);
            setToast({
                message: t('mode_switched') || `Mode switched to ${newMode.toUpperCase()}`,
                type: 'success'
            });
        } catch (error) {
            console.error('Failed to switch mode:', error);
            setToast({
                message: t('mode_switch_failed') || 'Failed to switch mode',
                type: 'error'
            });
        } finally {
            setIsToggling(false);
        }
    };

    const confirmMessage = artemis?.mode === 'demo'
        ? t('switch_to_real_mode_confirm') || 'Switch to REAL mode? This will use real funds and execute real trades. Are you sure?'
        : t('switch_to_demo_mode_confirm') || 'Switch to DEMO mode? This will use virtual funds for testing.';

    if (isLoading || !artemis) {
        return (
            <div className="flex items-center gap-2">
                <div className="w-9 h-5 bg-gray-700 rounded-full animate-pulse" />
            </div>
        );
    }

    const isDemo = artemis.mode === 'demo';

    return (
        <>
            <div 
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" 
                onClick={handleToggle}
                title={t('click_to_switch_mode') || `Click to switch to ${isDemo ? 'REAL' : 'DEMO'} mode`}
            >
                <p className={`text-sm font-semibold ${isDemo ? 'text-yellow-500' : 'text-red-500'}`}>
                    {isDemo ? '🟢 Demo' : '🔴 Live'}
                </p>
                <div className={`w-9 h-5 flex items-center rounded-full p-1 duration-300 ${isDemo ? 'bg-yellow-500/30' : 'bg-red-500/30'}`}>
                    <div className={`w-3 h-3 rounded-full shadow-md transform duration-300 ${isDemo ? 'translate-x-0 bg-yellow-500' : 'translate-x-4 bg-red-500'}`}/>
                </div>
            </div>
            <ConfirmModal
                isOpen={showConfirm}
                message={confirmMessage}
                onConfirm={handleConfirm}
                onCancel={() => setShowConfirm(false)}
                type={artemis?.mode === 'demo' ? 'danger' : 'warning'}
            />
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
}

const MobileMenu: React.FC<{ navLinks: any[], activeView: string, setActiveView: (view: string) => void, isOpen: boolean, setIsOpen: (isOpen: boolean) => void }> = ({ navLinks, activeView, setActiveView, isOpen, setIsOpen }) => {
    const { t } = useLanguage();
    return (
        <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsOpen(false)}>
            <div className={`fixed top-0 left-0 h-full w-64 bg-card shadow-xl transition-transform transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border">
                    <span className="text-xl font-bold text-foreground">TITAN</span>
                </div>
                <nav className="p-4 space-y-2">
                    {navLinks.map(link => (
                        <NavLink key={link.view} {...link} activeView={activeView} onClick={(view) => { setActiveView(view); setIsOpen(false); }} isMobile />
                    ))}
                </nav>
                <div className="p-4 border-t border-border">
                    <div className="text-sm text-muted-foreground mb-2">{t('mode') || 'Mode'}:</div>
                    <DemoModeToggle />
                </div>
            </div>
        </div>
    );
};


const Header: React.FC<HeaderProps> = ({ activeView, setActiveView, onLogout }) => {
    const { t } = useLanguage();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [statusData, setStatusData] = useState<{
        aiAgents: { active: number; total: number; percentage: number };
        connection: { status: string; text: string };
        activeTrades: number;
        dailyPnL: number;
    }>({
        aiAgents: { active: 0, total: 0, percentage: 0 },
        connection: { status: 'checking', text: t('connection') || 'Connection...' },
        activeTrades: 0,
        dailyPnL: 0,
    });

    const navLinks = [
        { text: t('dashboard'), view: 'dashboard' },
        { text: t('favorites'), view: 'favorites' },
        { text: t('trades'), view: 'trades' },
        { text: t('portfolio'), view: 'portfolio' },
        { text: t('analysis'), view: 'analysis' },
        { text: t('news'), view: 'news' },
        { text: t('ai'), view: 'ai' },
        { text: t('gold'), view: 'gold' },
        { text: t('settings'), view: 'settings' },
    ];

    // Fetch real status data from API
    useEffect(() => {
        const loadStatusData = async () => {
            try {
                const [artemisState, tradingStatus, connectionSettings] = await Promise.all([
                    api.fetchArtemisState().catch(() => null),
                    api.fetchTradingEngineStatus().catch(() => null),
                    api.fetchConnectionSettings().catch(() => null),
                ]);

                // Calculate AI agents status
                let aiActive = 0;
                let aiTotal = 0;
                if (artemisState?.agents) {
                    aiTotal = artemisState.agents.length;
                    aiActive = artemisState.agents.filter(a => a.status === 'active').length;
                }
                const aiPercentage = aiTotal > 0 ? Math.round((aiActive / aiTotal) * 100) : 0;

                // Get connection status
                const isConnected = connectionSettings?.isConnected || false;
                const connectionText = isConnected 
                    ? (t('connected') || 'Connected') 
                    : (t('disconnected') || 'Disconnected');

                // Get active trades and daily PNL
                const activeTrades = tradingStatus?.activeTrades || 0;
                const dailyPnL = tradingStatus?.stats?.dailyProfit 
                    ? tradingStatus.stats.dailyProfit - (tradingStatus.stats.dailyLoss || 0)
                    : 0;

                setStatusData({
                    aiAgents: { active: aiActive, total: aiTotal, percentage: aiPercentage },
                    connection: { status: isConnected ? 'connected' : 'disconnected', text: connectionText },
                    activeTrades,
                    dailyPnL,
                });
            } catch (error) {
                console.error('Failed to load status data:', error);
            }
        };

        loadStatusData();
        // Refresh every 10 seconds
        const interval = setInterval(loadStatusData, 10000);
        return () => clearInterval(interval);
    }, [t]);

    const statusIcons = [
        { 
            title: t('artemis_active'), 
            icon: <svg className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.5a1.5 1.5 0 011.5 1.5v1.5a1.5 1.5 0 01-3 0V5A1.5 1.5 0 0110 3.5zM5.5 10a1.5 1.5 0 011.5-1.5h1.5a1.5 1.5 0 010 3H7A1.5 1.5 0 015.5 10zM10 14.5a1.5 1.5 0 01-1.5-1.5v-1.5a1.5 1.5 0 013 0V13A1.5 1.5 0 0110 14.5zM14.5 10a1.5 1.5 0 01-1.5 1.5h-1.5a1.5 1.5 0 010-3H13A1.5 1.5 0 0114.5 10z" /></svg>, 
            text: statusData.aiAgents.total > 0 
                ? `AI: ${statusData.aiAgents.active} (${statusData.aiAgents.percentage}%)` 
                : 'AI: 0 (0%)'
        },
        { 
            title: t('connection'), 
            icon: <svg className={`h-5 w-5 ${statusData.connection.status === 'connected' ? 'text-green-400' : 'text-red-400'}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 2.586a2 2 0 012.828 0L18 5.172a2 2 0 010 2.828l-2.586 2.586a2 2 0 01-2.828 0L10 8.000l-2.586 2.586a2 2 0 01-2.828-2.828L7.172 5.172a2 2 0 012.828 0L12.586 2.586zM10 10l-2.586 2.586a2 2 0 01-2.828 0L2 10l2.586-2.586a2 2 0 012.828 0L10 10z" clipRule="evenodd" /></svg>, 
            text: statusData.connection.text
        },
        { 
            title: t('active_trades_header', { count: statusData.activeTrades }), 
            icon: <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>, 
            text: t('active_trades_header', { count: statusData.activeTrades })
        },
    ];

    return (
        <>
            <header className="bg-card/80 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center space-x-6">
                    <button className="lg:hidden text-muted-foreground" onClick={() => setIsMobileMenuOpen(true)}>
                         <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <div className="flex items-center space-x-2">
                        <svg className="h-7 w-7 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                        <span className="text-xl font-bold text-foreground">TITAN</span>
                    </div>
                    <nav className="hidden lg:flex items-center space-x-1">
                        {navLinks.map(link => (
                            <NavLink key={link.view} {...link} activeView={activeView} onClick={setActiveView} />
                        ))}
                    </nav>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="hidden md:flex items-center space-x-4 border-r border-border pr-4">
                        {statusIcons.map(item => (
                            <div key={item.title} className="flex items-center space-x-2" title={item.title}>
                            {item.icon}
                                <span className="text-sm text-muted-foreground">{item.text}</span>
                            </div>
                        ))}
                        <LanguageSwitcher />
                    </div>
                    {/* Demo/Real Mode Toggle - Always visible */}
                    <div className="border-r border-border pr-4">
                        <DemoModeToggle />
                    </div>
                    <UserDropdown setActiveView={setActiveView} onLogout={onLogout} dailyPnL={statusData.dailyPnL} />
                </div>
            </header>
            <MobileMenu navLinks={navLinks} activeView={activeView} setActiveView={setActiveView} isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />
        </>
    );
};

export default Header;
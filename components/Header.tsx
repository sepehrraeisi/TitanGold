import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useAppContext } from '../context/AppContext.tsx';
import * as api from '../services/api.ts';
import type { ArtemisState } from '../types.ts';
import { Toast } from './ui/toast.tsx';
import { ConfirmModal } from './ui/confirm-modal.tsx';

interface HeaderProps {
    activeView: string | 'dashboard' | 'favorites' | 'trades' | 'portfolio' | 'analysis' | 'news' | 'ai' | 'gold' | 'settings' | 'profile' | 'wallet';
    setActiveView: (view: string) => void;
    onLogout: () => void;
}

const NavLink: React.FC<{ text: string; view: string; activeView: string; onClick: (view: string) => void; isMobile?: boolean; }> = ({ text, view, activeView, onClick, isMobile }) => {
    const isActive = activeView === view;
    return (
        <button
            onClick={() => onClick(view)}
            className={`relative w-full text-left px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive
                    ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-400 shadow-lg shadow-blue-500/10 border border-blue-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            } ${isMobile ? 'text-base' : ''}`}
        >
            {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-full"></span>
            )}
            <span className="relative z-10">{text}</span>
        </button>
    );
};

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
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gradient-to-r hover:from-gray-800/50 hover:to-gray-700/50 transition-all duration-200 border border-transparent hover:border-gray-700/50"
            >
                {currentAvatar && !avatarError ? (
                    <div className="relative">
                        <img 
                            className="h-10 w-10 rounded-full object-cover border-2 border-gray-700 shadow-lg" 
                            src={currentAvatar} 
                            alt={user?.name || 'User'}
                            onError={() => {
                                console.warn('Avatar image failed to load:', currentAvatar);
                                setAvatarError(true);
                                setCurrentAvatar(null);
                            }}
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-900"></div>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold border-2 border-gray-700 shadow-lg ring-2 ring-blue-500/20">
                            {getInitials(user?.name)}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse"></div>
                    </div>
                )}
                <div className="text-left hidden md:block">
                    <p className="text-sm font-semibold text-gray-200">{user?.name}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[120px]">{user?.email || ''}</p>
                </div>
                {dailyPnL !== 0 && (
                <div className="text-left hidden lg:block border-l border-gray-700/50 pl-3 ml-3">
                        <p className={`text-sm font-bold ${dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {dailyPnL >= 0 ? '+' : ''}${dailyPnL.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">{t('today_pnl') || 'Today P&L'}</p>
                </div>
                )}
                <svg className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700/50 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-sm">
                    <div className="p-2">
                        <button 
                            onClick={() => handleNavigation('profile')} 
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-200 rounded-lg hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-purple-600/20 hover:text-blue-400 transition-all duration-200 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {t('profile')}
                        </button>
                        <button 
                            onClick={() => handleNavigation('settings')} 
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-200 rounded-lg hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-purple-600/20 hover:text-blue-400 transition-all duration-200 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {t('settings')}
                        </button>
                        <div className="border-t border-gray-700/50 my-1"></div>
                        <button 
                            onClick={onLogout} 
                            className="w-full text-left px-4 py-2.5 text-sm text-red-400 rounded-lg hover:bg-red-500/10 transition-all duration-200 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            {t('logout')}
                        </button>
                    </div>
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
        <button 
            onClick={toggleLanguage} 
            className="flex items-center justify-center p-2.5 rounded-lg hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-purple-600/20 transition-all duration-200 border border-transparent hover:border-gray-700/50 group" 
            title="Switch Language"
        >
            <svg className="h-5 w-5 text-gray-400 group-hover:text-blue-400 transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
            className="flex items-center gap-2.5 cursor-pointer group" 
            onClick={handleToggle}
            title={t('click_to_switch_mode') || `Click to switch to ${isDemo ? 'REAL' : 'DEMO'} mode`}
        >
            <div className="flex items-center gap-2">
                <div className={`relative w-11 h-6 flex items-center rounded-full p-1 duration-300 transition-all ${isDemo ? 'bg-gradient-to-r from-yellow-500/30 to-yellow-600/20 border border-yellow-500/40' : 'bg-gradient-to-r from-red-500/30 to-red-600/20 border border-red-500/40'}`}>
                    <div className={`absolute w-4 h-4 rounded-full shadow-lg transform duration-300 transition-all ${isDemo ? 'translate-x-0 bg-gradient-to-br from-yellow-400 to-yellow-600' : 'translate-x-5 bg-gradient-to-br from-red-400 to-red-600'}`}/>
                </div>
                <span className={`text-xs font-bold ${isDemo ? 'text-yellow-400' : 'text-red-400'} hidden sm:block`}>
                    {isDemo ? 'DEMO' : 'LIVE'}
                </span>
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
    <div className={`fixed inset-0 bg-black/70 backdrop-blur-md z-50 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsOpen(false)}>
        <div className={`fixed top-0 left-0 h-full w-72 bg-gradient-to-b from-gray-900 to-gray-950 shadow-2xl transition-transform transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-gray-800/50`} onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-800/50 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-lg">
                            <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                            </svg>
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">TITAN</span>
                    </div>
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="p-2 rounded-lg hover:bg-gray-800/50 text-gray-400 hover:text-gray-200 transition-all duration-200"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            <nav className="p-4 space-y-1 overflow-y-auto">
                {navLinks.map(link => (
                    <NavLink key={link.view} {...link} activeView={activeView} onClick={(view) => { setActiveView(view); setIsOpen(false); }} isMobile />
                ))}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800/50 bg-gray-900/50">
                <div className="text-sm text-gray-400 mb-2 font-medium">{t('mode') || 'Mode'}:</div>
                <DemoModeToggle />
            </div>
        </div>
    </div>
);
};


const WalletBalance: React.FC = () => {
    const { t } = useLanguage();
    const [balance, setBalance] = useState<{ total: number; mode: 'demo' | 'live' } | null>(null);
    const [isHidden, setIsHidden] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadBalance = async () => {
            try {
                setIsLoading(true);
                // Get trading mode first
                const artemisState = await api.fetchArtemisState().catch(() => null);
                const mode = artemisState?.mode || 'demo';

                if (mode === 'live') {
                    // In live mode, get total from all wallets
                    try {
                        const walletData = await api.fetchWalletData();
                        const totalUSD = walletData.stats.totalAssets || 0;
                        setBalance({ total: totalUSD, mode: 'live' });
                    } catch (error) {
                        console.warn('Failed to fetch live wallet data, trying API:', error);
                        // Fallback to API
                        const walletBalance = await api.fetchWalletBalance().catch(() => null);
                        if (walletBalance) {
                            const { USDT = 0, BTC = 0, ETH = 0 } = walletBalance.balances || {};
                            // Get prices for conversion
                            const [ethPrice, btcPrice] = await Promise.all([
                                api.fetchMexcTicker24hr('ETHUSDT').catch(() => [{ lastPrice: '2500' }]),
                                api.fetchMexcTicker24hr('BTCUSDT').catch(() => [{ lastPrice: '45000' }]),
                            ]);
                            const eth = parseFloat(ethPrice[0]?.lastPrice || '2500');
                            const btc = parseFloat(btcPrice[0]?.lastPrice || '45000');
                            const total = USDT + (BTC * btc) + (ETH * eth);
                            setBalance({ total, mode: 'live' });
                        }
                    }
                } else {
                    // In demo mode, get demo balance
                    const walletBalance = await api.fetchWalletBalance().catch(() => null);
                    if (walletBalance) {
                        const { USDT = 0, BTC = 0, ETH = 0 } = walletBalance.balances || {};
                        // Get prices for conversion
                        const [ethPrice, btcPrice] = await Promise.all([
                            api.fetchMexcTicker24hr('ETHUSDT').catch(() => [{ lastPrice: '2500' }]),
                            api.fetchMexcTicker24hr('BTCUSDT').catch(() => [{ lastPrice: '45000' }]),
                        ]);
                        const eth = parseFloat(ethPrice[0]?.lastPrice || '2500');
                        const btc = parseFloat(btcPrice[0]?.lastPrice || '45000');
                        const total = USDT + (BTC * btc) + (ETH * eth);
                        setBalance({ total, mode: 'demo' });
                    }
                }
            } catch (error) {
                console.error('Failed to load wallet balance:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadBalance();
        // Refresh every 30 seconds
        const interval = setInterval(loadBalance, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatBalance = (value: number): string => {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(2)}M`;
        } else if (value >= 1000) {
            return `$${(value / 1000).toFixed(2)}K`;
        }
        return `$${value.toFixed(2)}`;
    };

    if (isLoading || !balance) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/30 border border-gray-700/50">
                <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
                <span className="text-xs text-gray-400">{t('loading') || 'Loading...'}</span>
            </div>
        );
    }

    return (
        <button
            onClick={() => setIsHidden(!isHidden)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 hover:from-blue-600/30 hover:to-purple-600/30 transition-all duration-200 group"
            title={t('click_to_toggle_balance') || 'Click to toggle balance visibility'}
        >
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-medium">
                    {balance.mode === 'live' ? (t('wallet') || 'Wallet') : (t('demo_wallet') || 'Demo')}
                </span>
                <span className="text-sm font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
                    {isHidden ? '****' : formatBalance(balance.total)}
                </span>
            </div>
        </button>
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
            icon: (
                <div className="relative">
                    <svg className="h-5 w-5 text-purple-400 drop-shadow-[0_0_4px_rgba(168,85,247,0.6)]" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 3.5a1.5 1.5 0 011.5 1.5v1.5a1.5 1.5 0 01-3 0V5A1.5 1.5 0 0110 3.5zM5.5 10a1.5 1.5 0 011.5-1.5h1.5a1.5 1.5 0 010 3H7A1.5 1.5 0 015.5 10zM10 14.5a1.5 1.5 0 01-1.5-1.5v-1.5a1.5 1.5 0 013 0V13A1.5 1.5 0 0110 14.5zM14.5 10a1.5 1.5 0 01-1.5 1.5h-1.5a1.5 1.5 0 010-3H13A1.5 1.5 0 0114.5 10z" />
                    </svg>
                    {statusData.aiAgents.active > 0 && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    )}
                </div>
            ), 
            text: statusData.aiAgents.total > 0 
                ? `AI: ${statusData.aiAgents.active}/${statusData.aiAgents.total}` 
                : 'AI: 0/0'
        },
        { 
            title: t('connection'), 
            icon: (
                <div className="relative">
                    <svg className={`h-5 w-5 ${statusData.connection.status === 'connected' ? 'text-green-400 drop-shadow-[0_0_4px_rgba(74,222,128,0.6)]' : 'text-red-400 drop-shadow-[0_0_4px_rgba(248,113,113,0.6)]'}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.586 2.586a2 2 0 012.828 0L18 5.172a2 2 0 010 2.828l-2.586 2.586a2 2 0 01-2.828 0L10 8.000l-2.586 2.586a2 2 0 01-2.828-2.828L7.172 5.172a2 2 0 012.828 0L12.586 2.586zM10 10l-2.586 2.586a2 2 0 01-2.828 0L2 10l2.586-2.586a2 2 0 012.828 0L10 10z" clipRule="evenodd" />
                    </svg>
                    <div className={`absolute -top-1 -right-1 w-2 h-2 ${statusData.connection.status === 'connected' ? 'bg-green-400' : 'bg-red-400'} rounded-full ${statusData.connection.status === 'connected' ? 'animate-pulse' : ''}`}></div>
                </div>
            ), 
            text: statusData.connection.text
        },
        { 
            title: t('active_trades_header', { count: statusData.activeTrades }), 
            icon: (
                <div className="relative">
                    <svg className="h-5 w-5 text-blue-400 drop-shadow-[0_0_4px_rgba(96,165,250,0.6)]" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                        <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                    </svg>
                    {statusData.activeTrades > 0 && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    )}
                </div>
            ), 
            text: `${statusData.activeTrades} ${t('trades') || 'Trades'}`
        },
    ];

    return (
        <>
            <header className="bg-gradient-to-r from-gray-900/95 via-gray-900/95 to-gray-900/95 backdrop-blur-xl border-b border-gray-800/50 shadow-xl shadow-black/20 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center space-x-6">
                    <button 
                        className="lg:hidden text-gray-400 hover:text-gray-200 p-2 rounded-lg hover:bg-gray-800/50 transition-all duration-200" 
                        onClick={() => setIsMobileMenuOpen(true)}
                    >
                         <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <div className="flex items-center space-x-3 cursor-pointer group">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
                            <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-lg">
                                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                </svg>
                            </div>
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">TITAN</span>
                    </div>
                    <nav className="hidden lg:flex items-center space-x-1">
                        {navLinks.map(link => (
                            <NavLink key={link.view} {...link} activeView={activeView} onClick={setActiveView} />
                        ))}
                    </nav>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="hidden md:flex items-center space-x-3 border-r border-gray-700/50 pr-3">
                        {statusIcons.map(item => (
                            <div 
                                key={item.title} 
                                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-gray-800/50 transition-all duration-200 group" 
                                title={item.title}
                            >
                                <div className="group-hover:scale-110 transition-transform duration-200">
                                    {item.icon}
                                </div>
                                <span className="text-sm text-gray-300 font-medium">{item.text}</span>
                            </div>
                        ))}
                        <LanguageSwitcher />
                    </div>
                    {/* Wallet Balance */}
                    <div className="border-r border-gray-700/50 pr-3">
                        <WalletBalance />
                    </div>
                    {/* Demo/Real Mode Toggle - Always visible */}
                    <div className="border-r border-gray-700/50 pr-3">
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
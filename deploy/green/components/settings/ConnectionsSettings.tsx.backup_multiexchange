import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import * as api from '../../services/api.ts';
import type { WalletConnection } from '../../services/api.ts';

const SettingsCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-[#161B22] border border-gray-800 rounded-lg">
        <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="p-6 space-y-4">
            {children}
        </div>
    </div>
);

const InputField: React.FC<{ label: string, id: string, type: string, placeholder?: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ label, id, type, placeholder, value, onChange }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input
            type={type}
            id={id}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className="w-full p-2 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
    </div>
);

const ConnectionsSettings: React.FC = () => {
    const { t } = useLanguage();
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [exchangeMessage, setExchangeMessage] = useState(''); // پیام جداگانه برای Exchange
    const [accountInfo, setAccountInfo] = useState<any>(null);
    const [loadingAccount, setLoadingAccount] = useState(false);
    const [wallets, setWallets] = useState<WalletConnection[]>([]);
    const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
    const [walletConnectQR, setWalletConnectQR] = useState<string | null>(null);
    const [walletConnectUri, setWalletConnectUri] = useState<string | null>(null);
    const [checkingConnection, setCheckingConnection] = useState(false);
    const [walletMessage, setWalletMessage] = useState(''); // پیام جداگانه برای Wallet
    // اضافه کردن state برای Cold Wallet
    const [showColdWalletForm, setShowColdWalletForm] = useState(false);
    const [coldWalletAddress, setColdWalletAddress] = useState('');
    const [coldWalletName, setColdWalletName] = useState('');

    useEffect(() => {
        const fetchConnection = async () => {
            const connection = await api.fetchConnectionSettings();
            setApiKey(connection.apiKey);
            setApiSecret(connection.apiSecret);
            setIsConnected(connection.isConnected);
            
            // Load account info if connected
            if (connection.isConnected) {
                loadAccountInfo();
            }
        };
        fetchConnection();
        loadWallets();
    }, []);

    const loadAccountInfo = async () => {
        if (!isConnected) return;
        
        setLoadingAccount(true);
        try {
            const balance = await api.fetchMexcBalance();
            setAccountInfo(balance);
        } catch (error) {
            console.error('Failed to load account info:', error);
            setAccountInfo(null);
        } finally {
            setLoadingAccount(false);
        }
    };

    const loadWallets = async () => {
        try {
            const walletList = await api.fetchWalletConnections();
            setWallets(walletList);
        } catch (error) {
            console.error('Failed to load wallets:', error);
        }
    };

    const handleSaveChanges = async () => {
        if (!apiKey.trim() || !apiSecret.trim()) {
            setExchangeMessage('⚠️ Please enter both API Key and Secret');
            return;
        }
        
        try {
            setExchangeMessage('Saving...');
            await api.saveConnectionSettings({
                apiKey: apiKey.trim(), 
                apiSecret: apiSecret.trim(), 
                isConnected 
            });
            setExchangeMessage('✅ Settings saved successfully!');
            setTimeout(() => setExchangeMessage(''), 3000);
        } catch (error) {
            console.error('Save error:', error);
            setExchangeMessage('❌ Failed to save settings');
        }
    };

    const handleTestConnection = async () => {
        if (!apiKey.trim() || !apiSecret.trim()) {
            setExchangeMessage('⚠️ Please enter both API Key and Secret first');
            return;
        }
        
        setIsTesting(true);
        setExchangeMessage('Testing connection...');
        const result = await api.testMexcConnection(apiKey.trim(), apiSecret.trim());
        setExchangeMessage(result.message);
        setIsConnected(result.success);
        setIsTesting(false);
        
        // Auto-save if connection successful
        if (result.success) {
            await api.saveConnectionSettings({
                apiKey: apiKey.trim(),
                apiSecret: apiSecret.trim(),
                isConnected: true
            });
            // Load account info after successful connection
            await loadAccountInfo();
        } else {
            setAccountInfo(null);
        }
    };

    const handleConnectWallet = async (type: 'metamask' | 'walletconnect') => {
        setConnectingWallet(type);
        setWalletMessage(''); // Clear previous message
        try {
            let result;
            if (type === 'metamask') {
                result = await api.connectMetaMask();
                if (result.success && result.wallet) {
                    await loadWallets();
                    setWalletMessage(result.message);
                } else {
                    setWalletMessage(result.message);
                }
            } else {
                // WalletConnect
                result = await api.connectWalletConnect();
                if (result.success && result.qrCode && result.uri) {
                    setWalletConnectQR(result.qrCode);
                    setWalletConnectUri(result.uri);
                    setWalletMessage(result.message);
                    // Start checking connection status
                    checkWalletConnectConnection(result.uri);
                } else {
                    setWalletMessage(result.message);
                    // اگر QR code نیامد، دکمه را فعال کن
                    setConnectingWallet(null);
                }
            }
        } catch (error) {
            setWalletMessage(`❌ Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setConnectingWallet(null); // در صورت خطا دکمه را فعال کن
        } finally {
            // فقط برای MetaMask که فوری متصل می‌شود
            if (type === 'metamask') {
                setConnectingWallet(null);
            }
            // برای WalletConnect، دکمه بعد از اتصال یا cancel در checkWalletConnectConnection فعال می‌شود
        }
    };

    const checkWalletConnectConnection = async (uri: string) => {
        setCheckingConnection(true);
        
        // Set up event listeners for real-time connection
        api.setupWalletConnectListeners(
            async (wallet) => {
                console.log('WalletConnect: Connection successful via event listener', wallet);
                // Connected!
                await loadWallets();
                setWalletConnectQR(null);
                setWalletConnectUri(null);
                setConnectingWallet(null);
                setCheckingConnection(false);
                setWalletMessage(`✅ ${wallet.name} connected: ${wallet.address?.substring(0, 6)}...${wallet.address?.substring(wallet.address.length - 4)}`);
            },
            (error) => {
                console.error('WalletConnect: Connection error via event listener', error);
                setWalletMessage(`❌ Connection error: ${error.message}`);
                setCheckingConnection(false);
                setConnectingWallet(null);
            }
        );

        // Also poll for connection status as backup (check more frequently)
        const maxAttempts = 120; // 2 minutes
        let attempts = 0;

        const checkInterval = setInterval(async () => {
            attempts++;
            console.log(`WalletConnect: Polling attempt ${attempts}/${maxAttempts}`);
            
            const status = await api.checkWalletConnectStatus(uri);
            
            console.log('WalletConnect: Polling status result', status);
            
            if (status.connected && status.wallet) {
                console.log('WalletConnect: Connection detected via polling!');
                clearInterval(checkInterval);
                await loadWallets();
                setWalletConnectQR(null);
                setWalletConnectUri(null);
                setConnectingWallet(null);
                setCheckingConnection(false);
                setWalletMessage(status.message);
            } else if (attempts >= maxAttempts) {
                console.log('WalletConnect: Polling timeout reached');
                clearInterval(checkInterval);
                setWalletConnectQR(null);
                setWalletConnectUri(null);
                setConnectingWallet(null);
                setCheckingConnection(false);
                setWalletMessage('⏱️ Connection timeout. Please try again.');
            } else {
                // Update message with current status
                if (status.message && status.message !== '⏳ Waiting for connection...') {
                    setWalletMessage(status.message);
                }
            }
        }, 500); // Check every 500ms
    };

    // اضافه کردن تابع برای Cold Wallet
    const handleAddColdWallet = async () => {
        if (!coldWalletAddress.trim()) {
            setWalletMessage('⚠️ Please enter a wallet address');
            return;
        }

        // Validate Ethereum address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(coldWalletAddress.trim())) {
            setWalletMessage('❌ Invalid Ethereum address format');
            return;
        }

        try {
            const wallet: WalletConnection = {
                id: `cold-${coldWalletAddress.toLowerCase()}`,
                name: coldWalletName.trim() || 'Cold Wallet',
                type: 'coldwallet',
                address: coldWalletAddress.trim(),
                status: 'connected',
                network: '0x1',
                balance: 0, // Will be fetched later
                lastSyncedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            };

            await api.saveWalletConnection(wallet);
            await loadWallets();
            setShowColdWalletForm(false);
            setColdWalletAddress('');
            setColdWalletName('');
            setWalletMessage('✅ Cold wallet added successfully');
            
            // Try to fetch balance with retry logic
            const fetchBalanceWithRetry = async (address: string, maxRetries = 3): Promise<number | undefined> => {
                let lastError: Error | null = null;
                
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        const balance = await api.getWalletBalance(address);
                        if (balance !== undefined) {
                            return balance;
                        }
                    } catch (error) {
                        console.warn(`Balance fetch attempt ${attempt + 1}/${maxRetries} failed:`, error);
                        lastError = error instanceof Error ? error : new Error('Unknown error');
                        
                        // Wait before retry: exponential backoff (1s, 2s, 4s)
                        if (attempt < maxRetries - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
                        }
                    }
                }
                
                throw lastError || new Error('Failed to fetch balance after retries');
            };

            // Fetch balance in background (non-blocking)
            fetchBalanceWithRetry(coldWalletAddress.trim())
                .then(balance => {
                    if (balance !== undefined) {
                        wallet.balance = balance;
                        api.saveWalletConnection(wallet).then(() => {
                            loadWallets();
                            setWalletMessage(`✅ Cold wallet added with balance: ${balance.toFixed(4)} ETH`);
                        });
                    }
                })
                .catch(balanceError => {
                    console.warn('⚠️ Failed to fetch balance after retries:', balanceError);
                    setWalletMessage('⚠️ Cold wallet added but balance unavailable. Will retry in background.');
                    
                    // Schedule background retry after 30 seconds
                    setTimeout(async () => {
                        try {
                            const balance = await fetchBalanceWithRetry(coldWalletAddress.trim(), 2);
                            if (balance !== undefined) {
                                wallet.balance = balance;
                                await api.saveWalletConnection(wallet);
                                await loadWallets();
                                setWalletMessage(`✅ Balance updated: ${balance.toFixed(4)} ETH`);
                                setTimeout(() => setWalletMessage(''), 3000);
                            }
                        } catch (retryError) {
                            console.warn('Background balance fetch also failed:', retryError);
                        }
                    }, 30000); // Retry after 30 seconds
                });
        } catch (error) {
            setWalletMessage(`❌ Failed to add cold wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleDisconnectWallet = async (walletId: string) => {
        try {
            await api.deleteWalletConnection(walletId);
            await loadWallets();
            setWalletMessage('✅ Wallet disconnected successfully');
            setTimeout(() => setWalletMessage(''), 3000);
        } catch (error) {
            setWalletMessage('❌ Failed to disconnect wallet');
        }
    };

    const formatAddress = (address: string) => {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    const getWalletIcon = (type: string) => {
        const icons: { [key: string]: string } = {
            metamask: '🦊',
            walletconnect: '🔗',
            trustwallet: '💎',
            ledger: '🔒',
            trezor: '🛡️',
            coinbase: '🔵',
            coldwallet: '❄️', // اضافه کردن آیکون برای Cold Wallet
        };
        return icons[type] || '💼';
    };

    return (
        <div className="space-y-6">
            <SettingsCard title={t('exchange_api_keys')}>
                {/* Connection Status Indicator */}
                {isConnected && (
                    <div className="mb-4 p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="relative">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
                            </div>
                            <span className="text-green-400 font-semibold">✓ Connected to MEXC</span>
                        </div>
                        
                        {/* Account Information */}
                        {loadingAccount ? (
                            <div className="text-sm text-gray-400">Loading account information...</div>
                        ) : accountInfo ? (
                            <div className="space-y-2 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-gray-400">Total Balance:</span>
                                        <span className="text-green-400 font-semibold ml-2">
                                            {accountInfo.totalUSDT?.toLocaleString() || '0'} USDT
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">API Key:</span>
                                        <span className="text-gray-300 ml-2 font-mono text-xs">
                                            {apiKey.substring(0, 8)}...{apiKey.substring(apiKey.length - 4)}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Balances */}
                                {accountInfo.balances && accountInfo.balances.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-green-700/30">
                                        <div className="text-xs text-gray-400 mb-2">Available Balances:</div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {accountInfo.balances
                                                .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
                                                .slice(0, 6)
                                                .map((balance: any, idx: number) => (
                                                    <div key={idx} className="bg-black/20 p-2 rounded text-xs">
                                                        <div className="text-gray-300 font-semibold">{balance.asset}</div>
                                                        <div className="text-green-400">
                                                            {parseFloat(balance.free).toFixed(4)}
                                                            {parseFloat(balance.locked) > 0 && (
                                                                <span className="text-gray-500 ml-1">
                                                                    (Locked: {parseFloat(balance.locked).toFixed(4)})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-400">
                                Account information unavailable. Click "Test Connection" to refresh.
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label={t('mexc_api_key')} id="mexc_api_key" type="text" placeholder="******************" value={apiKey} onChange={e => setApiKey(e.target.value)} />
                    <InputField label={t('api_secret')} id="api_secret" type="password" placeholder="******************" value={apiSecret} onChange={e => setApiSecret(e.target.value)} />
                </div>
                <div className="flex gap-4 items-center">
                    <button onClick={handleSaveChanges} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors whitespace-nowrap">
                        {t('save_changes')}
                    </button>
                     <button onClick={handleTestConnection} disabled={isTesting} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors whitespace-nowrap disabled:opacity-50">
                        {isTesting ? '...' : t('test_connection')}
                    </button>
                </div>
                 {/* پیام جداگانه برای Exchange */}
                {exchangeMessage && 
                    <div className={`text-sm ${exchangeMessage.includes('✅') ? 'text-green-400' : exchangeMessage.includes('❌') ? 'text-red-400' : 'text-gray-400'}`}>
                        {exchangeMessage}
                    </div>
                 }
            </SettingsCard>

            <SettingsCard title={t('wallet_connections')}>
                <p className="text-sm text-gray-400 mb-4">
                    Connect your crypto wallets to track your portfolio seamlessly.
                </p>

                {/* WalletConnect QR Code Modal */}
                {walletConnectQR && (
                    <div className="mb-4 p-6 bg-[#0D111C] border border-blue-700/50 rounded-lg">
                        <div className="text-center mb-4">
                            <h4 className="text-lg font-semibold text-white mb-2">Scan with Mobile Wallet</h4>
                            <p className="text-sm text-gray-400 mb-4">
                                Open your mobile wallet app and scan this QR code
                            </p>
                        </div>
                        <div className="flex justify-center mb-4">
                            <img 
                                src={walletConnectQR} 
                                alt="WalletConnect QR Code" 
                                className="w-64 h-64 border-2 border-blue-500 rounded-lg p-2 bg-white"
                            />
                        </div>
                        {checkingConnection && (
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2 text-blue-400">
                                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-sm">Waiting for connection...</span>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-center gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setWalletConnectQR(null);
                                    setWalletConnectUri(null);
                                    setConnectingWallet(null); // فعال کردن دکمه
                                    setCheckingConnection(false);
                                }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Cold Wallet Form */}
                {showColdWalletForm && (
                    <div className="mb-4 p-6 bg-[#0D111C] border border-blue-700/50 rounded-lg">
                        <div className="text-center mb-4">
                            <h4 className="text-lg font-semibold text-white mb-2">Add Cold Wallet</h4>
                            <p className="text-sm text-gray-400 mb-4">
                                Enter your cold wallet address (Ledger, Trezor, or any hardware wallet)
                            </p>
                        </div>
                        <div className="space-y-3">
                            <InputField
                                label="Wallet Name (Optional)"
                                id="cold_wallet_name"
                                type="text"
                                placeholder="e.g., My Ledger Wallet"
                                value={coldWalletName}
                                onChange={(e) => setColdWalletName(e.target.value)}
                            />
                            <InputField
                                label="Wallet Address"
                                id="cold_wallet_address"
                                type="text"
                                placeholder="0x..."
                                value={coldWalletAddress}
                                onChange={(e) => setColdWalletAddress(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-center gap-3 mt-4">
                            <button
                                onClick={handleAddColdWallet}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                            >
                                Add Wallet
                            </button>
                            <button
                                onClick={() => {
                                    setShowColdWalletForm(false);
                                    setColdWalletAddress('');
                                    setColdWalletName('');
                                }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Connected Wallets List */}
                {wallets.length > 0 && (
                    <div className="mb-4 space-y-3">
                        {wallets.map((wallet) => (
                            <div
                                key={wallet.id}
                                className="p-4 bg-[#0D111C] border border-gray-700 rounded-lg flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl">{getWalletIcon(wallet.type)}</div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-white">{wallet.name}</span>
                                            {wallet.status === 'connected' && (
                                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                            )}
                                        </div>
                                        {wallet.address && (
                                            <div className="text-xs text-gray-400 font-mono mt-1">
                                                {formatAddress(wallet.address)}
                                            </div>
                                        )}
                                        {wallet.balance !== undefined && (
                                            <div className="text-sm text-green-400 mt-1">
                                                {wallet.balance.toFixed(4)} ETH
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDisconnectWallet(wallet.id)}
                                    className="text-red-400 hover:text-red-300 text-sm px-3 py-1 border border-red-700/50 rounded hover:bg-red-900/20 transition-colors"
                                >
                                    Disconnect
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Wallet Connection Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                        onClick={() => handleConnectWallet('metamask')}
                        disabled={connectingWallet !== null}
                        className="flex items-center justify-center gap-2 p-4 bg-[#0D111C] border border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-900/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-2xl">🦊</span>
                        <div className="text-left">
                            <div className="font-semibold text-white">MetaMask</div>
                            <div className="text-xs text-gray-400">Browser Extension</div>
                        </div>
                        {connectingWallet === 'metamask' && <span className="ml-auto">...</span>}
                    </button>

                    <button
                        onClick={() => handleConnectWallet('walletconnect')}
                        disabled={connectingWallet !== null}
                        className="flex items-center justify-center gap-2 p-4 bg-[#0D111C] border border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-900/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-2xl">🔗</span>
                        <div className="text-left">
                            <div className="font-semibold text-white">WalletConnect</div>
                            <div className="text-xs text-gray-400">Mobile Wallets</div>
                        </div>
                        {connectingWallet === 'walletconnect' && <span className="ml-auto">...</span>}
                    </button>

                    <button
                        onClick={() => setShowColdWalletForm(true)}
                        disabled={connectingWallet !== null || showColdWalletForm}
                        className="flex items-center justify-center gap-2 p-4 bg-[#0D111C] border border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-900/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-2xl">❄️</span>
                        <div className="text-left">
                            <div className="font-semibold text-white">Cold Wallet</div>
                            <div className="text-xs text-gray-400">Hardware Wallets</div>
                        </div>
                </button>
                </div>

                {/* پیام جداگانه برای Wallet */}
                {walletMessage && (
                    <div className={`text-sm mt-3 ${walletMessage.includes('✅') ? 'text-green-400' : walletMessage.includes('❌') ? 'text-red-400' : walletMessage.includes('📱') ? 'text-blue-400' : walletMessage.includes('⚠️') ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {walletMessage}
                    </div>
                )}
            </SettingsCard>
        </div>
    );
};

export default ConnectionsSettings;
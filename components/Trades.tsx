import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import ManualTrades from './trades/ManualTrades.tsx';
import ProfessionalAutopilot from './trades/ProfessionalAutopilot.tsx';
import Strategies from './trades/Strategies.tsx';
import MexcSpotCapabilityPanel from './trading/MexcSpotCapabilityPanel.tsx';
import MexcFuturesCapabilityPanel from './trading/MexcFuturesCapabilityPanel.tsx';
import * as api from '../services/api.ts';

type TradeView = 'manual' | 'autopilot' | 'strategies';

const Trades: React.FC = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<TradeView>('manual');
    const [isLoading, setIsLoading] = useState(true);
    
    // Optional pre-fetch; UI نباید در صورت خطا روی Loading بماند
    useEffect(() => {
        const loadTradeData = async () => {
            try {
                // Children خودشان داده‌شان را از بک‌اند می‌گیرند؛
                // این فقط یک pre-fetch سبک است و اگر خطا شود، صفحه باید باز هم رندر شود.
                await api.fetchStrategies().catch(() => undefined);
            } finally {
                setIsLoading(false);
            }
        };
        void loadTradeData();
    }, []);


    const renderContent = () => {
        switch (activeTab) {
            case 'manual':
                return <ManualTrades />;
            case 'autopilot':
                return <ProfessionalAutopilot />;
            case 'strategies':
                return <Strategies />;
            default:
                return null;
        }
    };
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">{t('advanced_trading_system')}</h1>
                <p className="text-gray-400 mt-1">{t('advanced_trading_desc')}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <MexcSpotCapabilityPanel />
                <MexcFuturesCapabilityPanel />
            </div>

            <div className="border-b border-gray-800">
                <nav className="-mb-px flex space-x-6">
                    <TabButton
                        label={t('manual_trades')}
                        isActive={activeTab === 'manual'}
                        onClick={() => setActiveTab('manual')}
                    />
                    <TabButton
                        label={t('professional_autopilot')}
                        isActive={activeTab === 'autopilot'}
                        onClick={() => setActiveTab('autopilot')}
                    />
                    <TabButton
                        label={t('strategies')}
                        isActive={activeTab === 'strategies'}
                        onClick={() => setActiveTab('strategies')}
                    />
                </nav>
            </div>
            
            <div>
                {isLoading ? <div className="text-center p-10">{t('loading')}</div> : renderContent()}
            </div>
        </div>
    );
};

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; }> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
            isActive
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-500'
        }`}
    >
        {label}
    </button>
);


export default Trades;
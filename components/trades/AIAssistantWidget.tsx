import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const AIAssistantWidget: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{t('ai_trading_assistant')}</h3>
            <div className="space-y-4">
                <div className="bg-blue-600/10 border-l-4 border-blue-500 p-3 rounded-r-md">
                    <p className="text-sm font-semibold text-blue-300">{t('smart_recommendation')}</p>
                    <p className="text-xs text-gray-300 mt-1">{t('buy_recommendation')}</p>
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-300 mb-2">{t('market_sentiment')}</p>
                    <div className="flex items-center gap-4 bg-gray-800/50 p-2 rounded-md">
                         <div className="w-full h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full">
                            <div className="h-full w-3/4 bg-gray-800/50 rounded-full relative">
                                <div className="absolute h-3 w-1 bg-white -top-0.5 rounded-full" style={{left: '72%'}}></div>
                            </div>
                         </div>
                         <div className="text-center">
                             <p className="text-lg font-bold text-green-400">72</p>
                             <p className="text-xs text-gray-400">{t('greed_state')}</p>
                         </div>
                    </div>
                </div>
                 <div>
                    <p className="text-sm font-semibold text-gray-300 mb-2">{t('strategy_manager')}</p>
                    <div className="space-y-2">
                        <StrategyToggle strategy={t('btc_scalping')} isActive={true} />
                        <StrategyToggle strategy={t('eth_dca')} isActive={false} />
                    </div>
                    <button className="text-xs text-purple-400 hover:underline mt-2">{t('manage_strategies')}</button>
                 </div>
            </div>
        </div>
    );
};

const StrategyToggle: React.FC<{ strategy: string, isActive: boolean }> = ({ strategy, isActive }) => (
    <div className="flex justify-between items-center text-sm p-2 bg-gray-800/50 rounded-md">
        <span className="font-medium text-gray-300">{strategy}</span>
        <button className={`px-2 py-0.5 text-xs rounded-full ${isActive ? 'bg-green-500/20 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
            {isActive ? 'ON' : 'OFF'}
        </button>
    </div>
);

export default AIAssistantWidget;

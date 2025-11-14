import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const QuickTradeWidget: React.FC = () => {
    const { t } = useLanguage();
    
    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
            <h3 className="font-semibold text-white mb-4">{t('quick_trade')}</h3>
            <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-md">
                    <span className="font-bold">BTC/USDT</span>
                    <div>
                        <p className="font-semibold">$43,250.00</p>
                        <p className="text-xs text-green-400 text-right">+2.45%</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button className="w-full py-2 bg-green-600/20 text-green-300 font-semibold rounded-md hover:bg-green-600/40">{t('quick_buy')}</button>
                    <button className="w-full py-2 bg-red-600/20 text-red-300 font-semibold rounded-md hover:bg-red-600/40">{t('quick_sell')}</button>
                </div>
                <div className="flex justify-between text-xs">
                    {[ '25%', '50%', '75%', 'MAX'].map(p => (
                        <button key={p} className="flex-1 py-1 mx-1 bg-gray-700/50 rounded-md hover:bg-gray-700">{p}</button>
                    ))}
                </div>
                 <div>
                    <label className="text-xs text-gray-400">{t('stop_loss')}</label>
                    <input type="text" className="w-full text-sm mt-1 p-1 bg-gray-800/50 border border-gray-700 rounded-md" placeholder="2.5%" />
                 </div>
                 <div>
                    <label className="text-xs text-gray-400">{t('take_profit')}</label>
                    <input type="text" className="w-full text-sm mt-1 p-1 bg-gray-800/50 border border-gray-700 rounded-md" placeholder="5.0%" />
                 </div>
            </div>
        </div>
    );
};

export default QuickTradeWidget;

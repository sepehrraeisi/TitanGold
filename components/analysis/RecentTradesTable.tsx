import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { PerformanceTrade } from '../../types.ts';

interface RecentTradesTableProps {
    trades: PerformanceTrade[];
}

const RecentTradesTable: React.FC<RecentTradesTableProps> = ({ trades }) => {
    const { t } = useLanguage();

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-800/30">
                    <tr>
                        <th className="px-4 py-3">{t('date')}</th>
                        <th className="px-4 py-3">{t('symbol')}</th>
                        <th className="px-4 py-3">{t('type')}</th>
                        <th className="px-4 py-3">{t('amount')}</th>
                        <th className="px-4 py-3">{t('entry_price')}</th>
                        <th className="px-4 py-3">{t('exit_price')}</th>
                        <th className="px-4 py-3">{t('pnl')} ($)</th>
                        <th className="px-4 py-3">{t('pnl')} (%)</th>
                    </tr>
                </thead>
                <tbody className="text-gray-200">
                    {trades.map(trade => (
                        <tr key={trade.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-4 py-3">{trade.date}</td>
                            <td className="px-4 py-3 font-semibold">{trade.symbol}</td>
                            <td className={`px-4 py-3 font-semibold ${trade.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{t(trade.type.toLowerCase())}</td>
                            <td className="px-4 py-3">{trade.amount}</td>
                            <td className="px-4 py-3">${trade.entryPrice.toLocaleString()}</td>
                            <td className="px-4 py-3">${trade.exitPrice.toLocaleString()}</td>
                            <td className={`px-4 py-3 font-semibold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString()}
                            </td>
                            <td className={`px-4 py-3 font-semibold ${trade.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {trade.pnlPercent.toFixed(2)}%
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default RecentTradesTable;
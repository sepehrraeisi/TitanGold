
import React from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import type { AIPrediction } from '../types.ts';

const AIPredictions: React.FC = () => {
    const { t } = useLanguage();

    const predictions: AIPrediction[] = [
        { id: '1', aiAgent: 'Momentum-v2', asset: 'BTC/USDT', prediction: 'Price will surpass $70,000 within 4h', probability: 75, status: 'Pending', timestamp: '15m ago' },
        { id: '2', aiAgent: 'MeanReversion-v4', asset: 'ETH/USDT', prediction: 'Price will revert to $3,780 support level', probability: 82, status: 'Correct', timestamp: '2h ago' },
        { id: '3', aiAgent: 'Scalper-v1', asset: 'SOL/USDT', prediction: 'Short-term volatility drop in the next 1h', probability: 60, status: 'Incorrect', timestamp: '3h ago' },
        { id: '4', aiAgent: 'Oracle-v1', asset: 'BNB/USDT', prediction: 'Positive funding rate increase expected', probability: 91, status: 'Correct', timestamp: '1d ago' },
        { id: '5', aiAgent: 'Momentum-v2', asset: 'XRP/USDT', prediction: 'Breakout above $0.55 resistance', probability: 68, status: 'Pending', timestamp: '45m ago' },
    ];

    const getStatusChip = (status: AIPrediction['status']) => {
        switch (status) {
            case 'Pending': return 'bg-yellow-500/10 text-yellow-400';
            case 'Correct': return 'bg-green-500/10 text-green-400';
            case 'Incorrect': return 'bg-red-500/10 text-red-400';
        }
    };
    
    const getProbabilityColor = (prob: number) => {
        if (prob > 80) return 'text-sky-400';
        if (prob > 65) return 'text-green-400';
        return 'text-yellow-400';
    }

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="bg-[#161B22] border border-gray-800 rounded-lg p-6">
                <h1 className="text-2xl font-bold text-white">{t('ai_predictions_title')}</h1>
                <p className="text-gray-400 mt-1 mb-6">{t('ai_predictions_desc')}</p>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
                            <tr>
                                <th scope="col" className="px-6 py-3">{t('asset')}</th>
                                <th scope="col" className="px-6 py-3">{t('prediction')}</th>
                                <th scope="col" className="px-6 py-3">{t('probability')}</th>
                                <th scope="col" className="px-6 py-3">{t('agent')}</th>
                                <th scope="col" className="px-6 py-3">{t('outcome')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {predictions.map(p => (
                                <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                    <td className="px-6 py-4 font-medium text-white">{p.asset}</td>
                                    <td className="px-6 py-4">{p.prediction}</td>
                                    <td className={`px-6 py-4 font-bold ${getProbabilityColor(p.probability)}`}>{p.probability}%</td>
                                    <td className="px-6 py-4 text-gray-300">{p.aiAgent}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusChip(p.status)}`}>
                                            {t(p.status.toLowerCase())}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AIPredictions;
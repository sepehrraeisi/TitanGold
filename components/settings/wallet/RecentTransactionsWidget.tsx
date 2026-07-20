
import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { WalletTransaction } from '../../../types.ts';

interface RecentTransactionsWidgetProps {
  transactions: WalletTransaction[];
}

const RecentTransactionsWidget: React.FC<RecentTransactionsWidgetProps> = ({ transactions }) => {
  const { t } = useLanguage();
  
  const handleViewAll = () => {
    alert(t('view_all_transactions_feature') || 'View all transactions feature coming soon!');
  };

  return (
    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-white">{t('recent_transactions')}</h3>
        <button 
          onClick={handleViewAll}
          className="text-xs text-purple-400 hover:underline transition-colors"
        >
          {t('view_all_transactions')}
        </button>
      </div>
      {transactions.length === 0 ? (
        <div className="text-center py-4 text-sm text-gray-400">
          {t('no_transactions')}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {transactions.map(tx => (
            <div key={tx.id} className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-white">{tx.type}: {tx.amount}</p>
                <p className="text-xs text-gray-400">{tx.exchange} - {tx.time}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                tx.status === 'Completed' 
                  ? 'bg-green-500/20 text-green-300' 
                  : 'bg-yellow-500/20 text-yellow-300'
              }`}>
                {tx.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentTransactionsWidget;

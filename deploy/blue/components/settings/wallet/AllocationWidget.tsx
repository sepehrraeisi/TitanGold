
import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { WalletAsset } from '../../../types.ts';

interface AllocationWidgetProps {
  assets: WalletAsset[];
}

const AllocationWidget: React.FC<AllocationWidgetProps> = ({ assets }) => {
  const { t } = useLanguage();
  return (
    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
      <h3 className="font-semibold text-white mb-4">{t('portfolio_allocation')}</h3>
      <div className="space-y-3">
        {assets.map(asset => (
          <div key={asset.id}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-semibold">{asset.name} ({asset.symbol})</span>
              <span>{asset.percentage}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${asset.percentage}%` }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AllocationWidget;

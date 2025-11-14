
import React from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';

const DeFiWidget: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
      <h3 className="font-semibold text-white mb-4">{t('defi_integration')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <DeFiCard title={t('yield_farming')} />
        <DeFiCard title={t('liquidity_pools')} />
        <DeFiCard title={t('staking')} subTitle={t('annual_yield_up_to')} />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-2">{t('supported_protocols')}</h4>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-400">
          <span>Uniswap V3</span>
          <span>PancakeSwap</span>
          <span>Aave</span>
          <span>Compound</span>
        </div>
      </div>
    </div>
  );
};

const DeFiCard: React.FC<{ title: string; subTitle?: string }> = ({ title, subTitle }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-gray-800/50 p-4 rounded-lg text-center">
            <p className="font-bold text-white">{title}</p>
            {subTitle && <p className="text-xs text-gray-400">{subTitle}</p>}
            <button className="mt-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-1 px-4 rounded-md">{t('manage')}</button>
        </div>
    );
};


export default DeFiWidget;

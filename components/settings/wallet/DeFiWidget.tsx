
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import * as api from '../../../services/api.ts';
import type { DeFiData, DeFiProtocol, DeFiPosition } from '../../../services/api.ts';

const DeFiWidget: React.FC = () => {
  const { t } = useLanguage();
  const [defiData, setDefiData] = useState<DeFiData | null>(null);
  const [selectedType, setSelectedType] = useState<'yield_farming' | 'liquidity_pool' | 'staking' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeFiData();
  }, []);

  const loadDeFiData = async () => {
    try {
      setLoading(true);
      const data = await api.fetchDeFiData();
      setDefiData(data);
    } catch (error) {
      console.error('Failed to load DeFi data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManage = (type: 'yield_farming' | 'liquidity_pool' | 'staking') => {
    setSelectedType(type);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedType(null);
  };

  const handleAddPosition = async (protocol: DeFiProtocol, amount: number) => {
    try {
      const position = {
        protocol: protocol.name,
        type: protocol.type,
        asset: 'ETH',
        amount: amount,
        apy: protocol.apy,
        value: amount * 2500, // ETH price
        status: 'active' as const,
      };
      
      const updated = await api.addDeFiPosition(position);
      setDefiData(updated);
      setShowModal(false);
      setSelectedType(null);
      alert(t('position_added_successfully') || 'Position added successfully!');
    } catch (error) {
      console.error('Failed to add position:', error);
      alert(t('failed_to_add_position') || 'Failed to add position');
    }
  };

  if (loading) {
    return (
      <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!defiData) {
    return null;
  }

  const filteredProtocols = selectedType 
    ? defiData.protocols.filter(p => p.type === selectedType)
    : defiData.protocols;

  return (
    <>
      <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">{t('defi_integration')}</h3>
          {defiData.totalValue > 0 && (
            <div className="text-xs text-gray-400">
              {t('total_value') || 'Total Value'}: ${defiData.totalValue.toLocaleString()}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <DeFiCard 
            title={t('yield_farming')} 
            onClick={() => handleManage('yield_farming')}
            positions={defiData.positions.filter(p => p.type === 'yield_farming').length}
            totalValue={defiData.positions.filter(p => p.type === 'yield_farming').reduce((sum, p) => sum + p.value, 0)}
          />
          <DeFiCard 
            title={t('liquidity_pools')} 
            onClick={() => handleManage('liquidity_pool')}
            positions={defiData.positions.filter(p => p.type === 'liquidity_pool').length}
            totalValue={defiData.positions.filter(p => p.type === 'liquidity_pool').reduce((sum, p) => sum + p.value, 0)}
          />
          <DeFiCard 
            title={t('staking')} 
            subTitle={t('annual_yield_up_to')}
            onClick={() => handleManage('staking')}
            positions={defiData.positions.filter(p => p.type === 'staking').length}
            totalValue={defiData.positions.filter(p => p.type === 'staking').reduce((sum, p) => sum + p.value, 0)}
          />
        </div>
        
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">{t('supported_protocols')}</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-400">
            {defiData.protocols.map(protocol => (
              <span 
                key={protocol.id}
                className={`px-2 py-1 rounded ${protocol.supported ? 'bg-green-500/20 text-green-300' : 'bg-gray-700/50 text-gray-500'}`}
                title={protocol.description}
              >
                {protocol.name}
              </span>
            ))}
          </div>
        </div>

        {/* Active Positions */}
        {defiData.positions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">{t('active_positions') || 'Active Positions'}</h4>
            <div className="space-y-2">
              {defiData.positions.slice(0, 3).map(position => (
                <div key={position.id} className="flex justify-between items-center text-xs bg-gray-800/30 p-2 rounded">
                  <div>
                    <span className="text-white font-semibold">{position.protocol}</span>
                    <span className="text-gray-400 ml-2">{position.amount.toFixed(4)} {position.asset}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400">${position.value.toLocaleString()}</div>
                    <div className="text-gray-500">{position.apy}% APY</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DeFi Management Modal */}
      {showModal && selectedType && (
        <DeFiModal
          type={selectedType}
          protocols={filteredProtocols}
          positions={defiData.positions.filter(p => p.type === selectedType)}
          onClose={handleCloseModal}
          onAddPosition={handleAddPosition}
          onRemovePosition={async (id) => {
            const updated = await api.removeDeFiPosition(id);
            setDefiData(updated);
          }}
        />
      )}
    </>
  );
};

interface DeFiCardProps {
  title: string;
  subTitle?: string;
  onClick: () => void;
  positions?: number;
  totalValue?: number;
}

const DeFiCard: React.FC<DeFiCardProps> = ({ title, subTitle, onClick, positions = 0, totalValue = 0 }) => {
    const { t } = useLanguage();
    return (
        <div className="bg-gray-800/50 p-4 rounded-lg text-center hover:bg-gray-800/70 transition-colors cursor-pointer" onClick={onClick}>
            <p className="font-bold text-white">{title}</p>
            {subTitle && <p className="text-xs text-gray-400 mt-1">{subTitle}</p>}
            {positions > 0 && (
              <div className="mt-2 text-xs text-gray-400">
                {positions} {t('positions') || 'positions'} • ${totalValue.toLocaleString()}
              </div>
            )}
            <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                className="mt-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-1 px-4 rounded-md transition-colors"
            >
                {t('manage')}
            </button>
        </div>
    );
};

interface DeFiModalProps {
  type: 'yield_farming' | 'liquidity_pool' | 'staking';
  protocols: DeFiProtocol[];
  positions: DeFiPosition[];
  onClose: () => void;
  onAddPosition: (protocol: DeFiProtocol, amount: number) => void;
  onRemovePosition: (id: string) => void;
}

const DeFiModal: React.FC<DeFiModalProps> = ({ type, protocols, positions, onClose, onAddPosition, onRemovePosition }) => {
  const { t } = useLanguage();
  const [selectedProtocol, setSelectedProtocol] = useState<DeFiProtocol | null>(null);
  const [amount, setAmount] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const typeLabels: { [key: string]: string } = {
    yield_farming: t('yield_farming'),
    liquidity_pool: t('liquidity_pools'),
    staking: t('staking'),
  };

  const handleSubmit = () => {
    if (!selectedProtocol || !amount || parseFloat(amount) <= 0) {
      alert(t('please_fill_all_fields') || 'Please fill all fields');
      return;
    }
    onAddPosition(selectedProtocol, parseFloat(amount));
    setAmount('');
    setSelectedProtocol(null);
    setShowAddForm(false);
  };

  const handleRemovePosition = (positionId: string) => {
    const confirmMessage = t('confirm_remove_position') || 'Are you sure you want to remove this position?';
    if (window.confirm(confirmMessage)) {
      onRemovePosition(positionId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-[#1c1e2f] border border-gray-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">{typeLabels[type]}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Add New Position */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {showAddForm ? t('cancel') || 'Cancel' : t('add_new_position') || '+ Add New Position'}
          </button>
          
          {showAddForm && (
            <div className="mt-4 p-4 bg-gray-800/50 rounded-lg space-y-3">
              <div>
                <label className="text-sm text-gray-300 block mb-1">{t('select_protocol') || 'Select Protocol'}</label>
                <select
                  value={selectedProtocol?.id || ''}
                  onChange={(e) => {
                    const protocol = protocols.find(p => p.id === e.target.value);
                    setSelectedProtocol(protocol || null);
                  }}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="">{t('choose_protocol') || 'Choose a protocol...'}</option>
                  {protocols.map(protocol => (
                    <option key={protocol.id} value={protocol.id}>
                      {protocol.name} ({protocol.apy}% APY)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-300 block mb-1">{t('amount') || 'Amount (ETH)'}</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <button
                onClick={handleSubmit}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                {t('add_position') || 'Add Position'}
              </button>
            </div>
          )}
        </div>

        {/* Active Positions */}
        {positions.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-300">{t('active_positions') || 'Active Positions'}</h4>
            {positions.map(position => (
              <div key={position.id} className="bg-gray-800/50 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">{position.protocol}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {position.amount.toFixed(4)} {position.asset} • {position.apy}% APY
                  </div>
                  <div className="text-xs text-green-400 mt-1">
                    ${position.value.toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleRemovePosition(position.id)}
                  className="text-red-400 hover:text-red-300 text-sm px-3 py-1 border border-red-700/50 rounded hover:bg-red-900/20 transition-colors"
                >
                  {t('remove') || 'Remove'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>{t('no_positions_yet') || 'No positions yet. Add your first position to get started!'}</p>
          </div>
        )}

        {/* Available Protocols */}
        <div className="mt-6 pt-6 border-t border-gray-700/50">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">{t('available_protocols') || 'Available Protocols'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {protocols.map(protocol => (
              <div key={protocol.id} className="bg-gray-800/30 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{protocol.name}</div>
                    <div className="text-xs text-gray-400 mt-1">{protocol.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-semibold">{protocol.apy}% APY</div>
                    <div className="text-xs text-gray-500">${(protocol.tvl / 1000000).toFixed(0)}M TVL</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeFiWidget;

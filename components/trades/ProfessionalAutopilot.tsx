import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import StatCard from './StatCard.tsx';

const ControlCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={`bg-[#1c1e2f] border border-gray-700/50 rounded-lg ${className}`}>
        <h3 className="font-semibold text-white p-4 border-b border-gray-700/50">{title}</h3>
        <div className="p-4">{children}</div>
    </div>
);

const ProfessionalAutopilot: React.FC = () => {
    const { t } = useLanguage();

    const stats = [
        { label: t('total_performance'), value: '7', subValue: 'Today Profit' },
        { label: t('win_rate'), value: '78.2%', subValue: 'Win Rate' },
        { label: t('total_trades'), value: '156', subValue: 'Total Trades' },
        { label: t('today_profit'), value: '$2,847', subValue: 'Today Profit' },
    ];
    
    const aiStatus = [
        { name: t('artemis_ai'), status: 'active' },
        { name: t('chatgpt4'), status: 'connected' },
        { name: t('google_gemini'), status: 'connected' },
        { name: t('claude3'), status: 'connected' },
        { name: t('ai_agents_15'), status: '13/15 active' },
    ];

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg p-6 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-white">{t('professional_autopilot_system')}</h2>
                    <p className="text-gray-400">{t('full_control_desc')}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm text-gray-300">{t('system_status')}</p>
                        <p className="font-bold text-green-400">{t('active')}</p>
                    </div>
                    <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">{t('emergency_stop')}</button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map(stat => (
                    <StatCard key={stat.label} label={stat.label} value={stat.value} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <ControlCard title={t('system_control')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-400">{t('autopilot_status')}</label>
                                    {/* Toggle Switch Placeholder */}
                                    <div className="mt-1 h-8 bg-green-500/20 rounded-lg flex items-center px-2 text-green-300 font-semibold">{t('active')}</div>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">{t('operating_mode')}</label>
                                    <select className="w-full mt-1 p-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-purple-500 focus:border-purple-500">
                                        <option>{t('balanced_mode')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400">{t('trading_budget')}</label>
                                    <input type="number" defaultValue="50000" className="w-full mt-1 p-2 bg-gray-800/50 border border-gray-700 rounded-lg" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-400">{t('risk_level')}</label>
                                    <div className="space-y-2 mt-1">
                                        <label className="flex items-center"><input type="radio" name="risk" className="form-radio text-purple-500 bg-gray-700" /> <span className="ml-2 text-xs">{t('conservative_risk')}</span></label>
                                        <label className="flex items-center"><input type="radio" name="risk" className="form-radio text-purple-500 bg-gray-700" defaultChecked /> <span className="ml-2 text-xs">{t('balanced_risk')}</span></label>
                                        <label className="flex items-center"><input type="radio" name="risk" className="form-radio text-purple-500 bg-gray-700" /> <span className="ml-2 text-xs">{t('aggressive_risk')}</span></label>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-4">
                                     <button className="flex-1 bg-yellow-600/80 hover:bg-yellow-600 text-white font-semibold py-2 rounded-lg text-sm">{t('temp_stop')}</button>
                                     <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg text-sm">{t('reset_system')}</button>
                                </div>
                            </div>
                        </div>
                    </ControlCard>
                    <ControlCard title={t('targeted_trades')}>
                        <div className="flex items-end gap-4">
                            <div className="flex-1">
                                <label className="text-sm text-gray-400">{t('initial_amount')}</label>
                                <input type="number" defaultValue="100" className="w-full mt-1 p-2 bg-gray-800/50 border border-gray-700 rounded-lg" />
                            </div>
                            <div className="flex-1">
                                <label className="text-sm text-gray-400">{t('target_amount')}</label>
                                <input type="number" defaultValue="5000" className="w-full mt-1 p-2 bg-gray-800/50 border border-gray-700 rounded-lg" />
                            </div>
                            <button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg">{t('start_new_goal')}</button>
                        </div>
                    </ControlCard>
                </div>
                <div className="space-y-6">
                    <ControlCard title={t('ai_status')} className="flex-1">
                       <div className="space-y-3">
                         {aiStatus.map(item => (
                            <div key={item.name} className="flex justify-between items-center text-sm">
                                <span className="text-gray-300">{item.name}</span>
                                <span className={`font-semibold ${item.status === 'connected' || item.status.includes('active') ? 'text-green-400' : 'text-yellow-400'}`}>{item.status}</span>
                            </div>
                         ))}
                       </div>
                    </ControlCard>
                     <ControlCard title={t('quick_actions')} className="flex-1">
                        <div className="flex flex-col space-y-2">
                             <button className="w-full text-left p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm">{t('ai_decisions')}</button>
                             <button className="w-full text-left p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm">{t('performance_report')}</button>
                             <button className="w-full text-left p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm">{t('export_settings')}</button>
                        </div>
                    </ControlCard>
                </div>
            </div>
        </div>
    );
};

export default ProfessionalAutopilot;

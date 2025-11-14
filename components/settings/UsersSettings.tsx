
import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { User } from '../../types.ts';

const UsersSettings: React.FC = () => {
    const { t } = useLanguage();
    
    const users: User[] = [
        { id: '1', name: 'Admin User', email: 'admin@titan.ai', role: 'Admin' },
        { id: '2', name: 'Trader One', email: 'trader.one@titan.ai', role: 'Trader' },
        { id: '3', name: 'Viewer Analyst', email: 'analyst@titan.ai', role: 'Viewer' },
    ];

    return (
        <div className="bg-[#161B22] border border-gray-800 rounded-lg">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-white">{t('settings_users')}</h3>
                    <p className="text-sm text-gray-400 mt-1">{t('admin_view')}</p>
                </div>
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors">{t('add_user')}</button>
            </div>
            <div className="p-6">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
                            <tr>
                                <th scope="col" className="px-6 py-3">{t('user')}</th>
                                <th scope="col" className="px-6 py-3">{t('role')}</th>
                                <th scope="col" className="px-6 py-3">{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-white">{user.name}</div>
                                        <div className="text-gray-500">{user.email}</div>
                                    </td>
                                    <td className="px-6 py-4">{user.role}</td>
                                    <td className="px-6 py-4">
                                        <button className="text-red-400 hover:underline">{t('remove')}</button>
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

export default UsersSettings;
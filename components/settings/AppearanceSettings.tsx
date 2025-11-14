import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAppContext } from '../../context/AppContext.tsx';

const SettingsCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-card border border-border rounded-lg">
        <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
        <div className="p-6 space-y-4">
            {children}
        </div>
    </div>
);

const AppearanceSettings: React.FC = () => {
    const { t, language, setLanguage } = useLanguage();
    const { theme, setTheme } = useAppContext();

    return (
        <div className="space-y-6">
            <SettingsCard title={t('theme')}>
                 <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => setTheme('dark')}
                        className={`flex-1 text-center py-4 rounded-lg transition-all border-2 ${
                            theme === 'dark' 
                            ? 'border-primary bg-primary/20 text-foreground' 
                            : 'border-border bg-secondary text-muted-foreground hover:border-border'
                        }`}
                    >
                        {t('dark_mode')}
                    </button>
                    <button 
                         onClick={() => setTheme('light')}
                         className={`flex-1 text-center py-4 rounded-lg transition-all border-2 ${
                            theme === 'light' 
                            ? 'border-primary bg-primary/20 text-foreground' 
                            : 'border-border bg-secondary text-muted-foreground hover:border-border'
                        }`}
                    >
                        {t('light_mode')}
                    </button>
                </div>
            </SettingsCard>
             <SettingsCard title={t('language')}>
                <select 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value as 'en' | 'fa')}
                    className="w-full p-2 bg-input border border-border rounded-md focus:ring-primary focus:border-primary"
                >
                    <option value="en">English</option>
                    <option value="fa">فارسی</option>
                </select>
            </SettingsCard>
        </div>
    );
};

export default AppearanceSettings;
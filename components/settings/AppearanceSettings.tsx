import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAppContext } from '../../context/AppContext.tsx';
import * as api from '../../services/api.ts';
import { userPreferencesService } from '../../services/userPreferences.ts';

const SettingsCard: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="p-6 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
        </div>
        <div className="p-6 space-y-6">
            {children}
        </div>
    </div>
);

const AppearanceSettings: React.FC = () => {
    const { t, language, setLanguage } = useLanguage();
    const { theme, setTheme } = useAppContext();
    const [settings, setSettings] = useState<api.AppearanceSettingsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'theme' | 'colors' | 'typography' | 'layout' | 'display' | 'dashboard' | 'notifications' | 'accessibility'>('theme');

    useEffect(() => {
        loadSettings();
    }, []);

    // Apply settings changes in real-time
    useEffect(() => {
        if (!settings) return;
        
        // Apply theme immediately
        if (settings.theme !== 'auto') {
            setTheme(settings.theme);
        } else if (typeof window !== 'undefined' && window.matchMedia) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setTheme(prefersDark ? 'dark' : 'light');
        }
        
        // Apply CSS variables and attributes
        if (typeof document !== 'undefined') {
            const root = document.documentElement;
            const body = document.body;
            
            // Color scheme
            root.style.setProperty('--color-primary', settings.colorScheme.primary);
            root.style.setProperty('--color-accent', settings.colorScheme.accent);
            root.style.setProperty('--color-background', settings.colorScheme.background);
            root.style.setProperty('--color-surface', settings.colorScheme.surface);
            root.style.setProperty('--color-text', settings.colorScheme.text);
            root.style.setProperty('--color-text-secondary', settings.colorScheme.textSecondary);
            
            // Typography
            if (settings.typography.fontFamily === 'custom' && settings.typography.customFont) {
                root.style.setProperty('--font-family', `"${settings.typography.customFont}", sans-serif`);
                body.style.fontFamily = `"${settings.typography.customFont}", sans-serif`;
            } else if (settings.typography.fontFamily !== 'system') {
                const fontMap: { [key: string]: string } = {
                    'inter': '"Inter", sans-serif',
                    'roboto': '"Roboto", sans-serif',
                    'open-sans': '"Open Sans", sans-serif',
                };
                const fontFamily = fontMap[settings.typography.fontFamily] || 'system-ui, sans-serif';
                root.style.setProperty('--font-family', fontFamily);
                body.style.fontFamily = fontFamily;
            } else {
                root.style.setProperty('--font-family', 'system-ui, sans-serif');
                body.style.fontFamily = 'system-ui, sans-serif';
            }
            
            const fontSizeMap: { [key: string]: string } = {
                'small': '0.875rem',
                'medium': '1rem',
                'large': '1.125rem',
                'xlarge': '1.25rem',
            };
            const fontSize = fontSizeMap[settings.typography.fontSize] || '1rem';
            root.style.setProperty('--font-size-base', fontSize);
            body.style.fontSize = fontSize;
            
            const fontWeightMap: { [key: string]: string } = {
                'normal': '400',
                'medium': '500',
                'semibold': '600',
                'bold': '700',
            };
            const fontWeight = fontWeightMap[settings.typography.fontWeight] || '400';
            root.style.setProperty('--font-weight-base', fontWeight);
            body.style.fontWeight = fontWeight;
            
            const lineHeightMap: { [key: string]: string } = {
                'tight': '1.25',
                'normal': '1.5',
                'relaxed': '1.75',
            };
            const lineHeight = lineHeightMap[settings.typography.lineHeight] || '1.5';
            root.style.setProperty('--line-height-base', lineHeight);
            body.style.lineHeight = lineHeight;
            
            // Layout
            root.setAttribute('data-sidebar-position', settings.layout.sidebarPosition);
            root.setAttribute('data-sidebar-width', settings.layout.sidebarWidth);
            root.setAttribute('data-density', settings.layout.density);
            root.setAttribute('data-compact-mode', settings.layout.compactMode ? 'true' : 'false');
            
            const sidebarWidthMap: { [key: string]: string } = {
                'narrow': '200px',
                'medium': '250px',
                'wide': '300px',
            };
            root.style.setProperty('--sidebar-width', sidebarWidthMap[settings.layout.sidebarWidth] || '250px');
            
            const densityMap: { [key: string]: string } = {
                'comfortable': '1rem',
                'compact': '0.5rem',
                'spacious': '1.5rem',
            };
            root.style.setProperty('--spacing-base', densityMap[settings.layout.density] || '1rem');
            
            // Display
            root.setAttribute('data-chart-theme', settings.display.chartTheme);
            root.setAttribute('data-chart-style', settings.display.chartStyle);
            
            // Accessibility
            if (settings.accessibility.highContrast) {
                root.classList.add('high-contrast');
            } else {
                root.classList.remove('high-contrast');
            }
            
            if (settings.accessibility.largeText) {
                root.classList.add('large-text');
            } else {
                root.classList.remove('large-text');
            }
            
            // Reduce motion
            if (settings.display.reduceMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
                root.classList.add('reduce-motion');
            } else {
                root.classList.remove('reduce-motion');
            }
            
            // Show/hide animations
            if (!settings.display.showAnimations) {
                root.classList.add('no-animations');
            } else {
                root.classList.remove('no-animations');
            }
            
            // Show/hide tooltips
            if (!settings.display.showTooltips) {
                root.setAttribute('data-tooltips', 'disabled');
            } else {
                root.removeAttribute('data-tooltips');
            }
            
            // 🚀 NEW: Dashboard settings - sync to Backend API instead of LocalStorage only
            // Use async IIFE (Immediately Invoked Function Expression) to handle await
            (async () => {
                try {
                    await userPreferencesService.updatePreference('dashboard', settings.dashboard);
                    await userPreferencesService.updatePreference('notifications', settings.notifications);
                } catch (error) {
                    console.warn('Failed to sync dashboard settings to backend:', error);
                    // Fallback to LocalStorage for offline mode
                    localStorage.setItem('titan_dashboard_settings', JSON.stringify(settings.dashboard));
                    localStorage.setItem('titan_notification_settings', JSON.stringify(settings.notifications));
                }
            })();
        }
    }, [settings, setTheme]);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            // 🚀 NEW: Try loading from Backend API first
            try {
                const preferences = await userPreferencesService.getPreferences();
                if (preferences.appearance) {
                    setSettings(preferences.appearance as api.AppearanceSettingsData);
                    return;
                }
            } catch (backendError) {
                console.warn('Backend API unavailable, falling back to legacy API:', backendError);
            }
            
            // Fallback: Use legacy API
            const data = await api.fetchAppearanceSettings();
            setSettings(data);
        } catch (error) {
            console.error('Failed to load appearance settings:', error);
            setStatusMessage('❌ Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
            // 🚀 NEW: Save to Backend API first
            await userPreferencesService.updatePreference('appearance', settings);
            
            // Also save to legacy API for backward compatibility
            await api.saveAppearanceSettings(settings);
            
            setStatusMessage('✅ Settings saved successfully!');
            setTimeout(() => setStatusMessage(''), 3000);
        } catch (error) {
            console.error('Failed to save:', error);
            setStatusMessage('❌ Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        if (window.confirm(t('reset_appearance_confirm') || 'Are you sure you want to reset all appearance settings to default?')) {
            try {
                await api.resetAppearanceSettings();
                await loadSettings();
                setStatusMessage('✅ Settings reset to default');
            } catch (error) {
                setStatusMessage('❌ Failed to reset settings');
            }
        }
    };

    const updateSettings = (updates: Partial<api.AppearanceSettingsData>) => {
        setSettings(prev => {
            if (!prev) return null;
            const updated = { ...prev, ...updates };
            
            // Deep merge for nested objects
            if (updates.colorScheme && prev.colorScheme) {
                updated.colorScheme = { ...prev.colorScheme, ...updates.colorScheme };
            }
            if (updates.typography && prev.typography) {
                updated.typography = { ...prev.typography, ...updates.typography };
            }
            if (updates.layout && prev.layout) {
                updated.layout = { ...prev.layout, ...updates.layout };
            }
            if (updates.display && prev.display) {
                updated.display = { ...prev.display, ...updates.display };
            }
            if (updates.dashboard && prev.dashboard) {
                updated.dashboard = { ...prev.dashboard, ...updates.dashboard };
            }
            if (updates.notifications && prev.notifications) {
                updated.notifications = { ...prev.notifications, ...updates.notifications };
            }
            if (updates.accessibility && prev.accessibility) {
                updated.accessibility = { ...prev.accessibility, ...updates.accessibility };
            }
            
            return updated;
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-10">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-gray-800 overflow-x-auto">
                {(['theme', 'colors', 'typography', 'layout', 'display', 'dashboard', 'notifications', 'accessibility'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 font-semibold transition-colors whitespace-nowrap ${
                            activeTab === tab
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-gray-300'
                        }`}
                    >
                        {t(`appearance_${tab}`) || tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Status Message */}
            {statusMessage && (
                <div className={`p-3 rounded-md ${
                    statusMessage.includes('✅') ? 'bg-green-900/20 border border-green-700/50 text-green-300' :
                    statusMessage.includes('❌') ? 'bg-red-900/20 border border-red-700/50 text-red-300' :
                    'bg-blue-900/20 border border-blue-700/50 text-blue-300'
                }`}>
                    {statusMessage}
                </div>
            )}

            {/* Tab Content */}
            {activeTab === 'theme' && (
                <SettingsCard title={t('theme') || 'Theme'} description={t('theme_desc') || 'Choose your preferred color theme'}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(['dark', 'light', 'auto'] as const).map(themeOption => (
                                <button
                                    key={themeOption}
                                    onClick={() => {
                                        updateSettings({ theme: themeOption });
                                        if (themeOption !== 'auto') {
                                            setTheme(themeOption);
                                        }
                                    }}
                                    className={`p-4 rounded-lg border-2 transition-all ${
                                        settings.theme === themeOption
                                            ? 'border-blue-500 bg-blue-500/20'
                                            : 'border-gray-700 hover:border-gray-600'
                                    }`}
                                >
                                    <div className="text-lg font-semibold text-white mb-2">
                                        {t(`theme_${themeOption}`) || themeOption}
                                    </div>
                                    <div className="text-sm text-gray-400">
                                        {t(`theme_${themeOption}_desc`) || `Use ${themeOption} theme`}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="pt-4 border-t border-gray-700">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('language') || 'Language'}
                            </label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as 'en' | 'fa')}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                            >
                                <option value="en">English</option>
                                <option value="fa">فارسی</option>
                            </select>
                        </div>
                    </div>
                </SettingsCard>
            )}

            {activeTab === 'colors' && (
                <SettingsCard title={t('color_scheme') || 'Color Scheme'} description={t('color_scheme_desc') || 'Customize your color palette'}>
                    <div className="space-y-4">
                        {Object.entries(settings.colorScheme).map(([key, value]) => (
                            <div key={key}>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t(`color_${key}`) || key}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={value}
                                        onChange={(e) => updateSettings({
                                            colorScheme: {
                                                ...settings.colorScheme,
                                                [key]: e.target.value
                                            }
                                        })}
                                        className="w-16 h-10 rounded border border-gray-600"
                                    />
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => updateSettings({
                                            colorScheme: {
                                                ...settings.colorScheme,
                                                [key]: e.target.value
                                            }
                                        })}
                                        className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white font-mono text-sm"
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={() => updateSettings({
                                colorScheme: {
                                    primary: '#3b82f6',
                                    accent: '#8b5cf6',
                                    background: '#111827',
                                    surface: '#1f2937',
                                    text: '#f9fafb',
                                    textSecondary: '#9ca3af',
                                }
                            })}
                            className="text-sm text-blue-400 hover:text-blue-300"
                        >
                            {t('reset_to_default') || 'Reset to Default'}
                        </button>
                    </div>
                </SettingsCard>
            )}

            {activeTab === 'typography' && (
                <SettingsCard title={t('typography') || 'Typography'} description={t('typography_desc') || 'Customize fonts and text appearance'}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('font_family') || 'Font Family'}
                            </label>
                            <select
                                value={settings.typography.fontFamily}
                                onChange={(e) => updateSettings({
                                    typography: {
                                        ...settings.typography,
                                        fontFamily: e.target.value as any
                                    }
                                })}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                            >
                                <option value="system">{t('font_system') || 'System Default'}</option>
                                <option value="inter">Inter</option>
                                <option value="roboto">Roboto</option>
                                <option value="open-sans">Open Sans</option>
                                <option value="custom">{t('font_custom') || 'Custom'}</option>
                            </select>
                        </div>
                        {settings.typography.fontFamily === 'custom' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('custom_font') || 'Custom Font Name'}
                                </label>
                                <input
                                    type="text"
                                    value={settings.typography.customFont || ''}
                                    onChange={(e) => updateSettings({
                                        typography: {
                                            ...settings.typography,
                                            customFont: e.target.value
                                        }
                                    })}
                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                    placeholder="e.g., 'Arial', 'Helvetica'"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('font_size') || 'Font Size'}
                            </label>
                            <select
                                value={settings.typography.fontSize}
                                onChange={(e) => updateSettings({
                                    typography: {
                                        ...settings.typography,
                                        fontSize: e.target.value as any
                                    }
                                })}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                            >
                                <option value="small">{t('font_size_small') || 'Small'}</option>
                                <option value="medium">{t('font_size_medium') || 'Medium'}</option>
                                <option value="large">{t('font_size_large') || 'Large'}</option>
                                <option value="xlarge">{t('font_size_xlarge') || 'Extra Large'}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('font_weight') || 'Font Weight'}
                            </label>
                            <select
                                value={settings.typography.fontWeight}
                                onChange={(e) => updateSettings({
                                    typography: {
                                        ...settings.typography,
                                        fontWeight: e.target.value as any
                                    }
                                })}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                            >
                                <option value="normal">{t('font_weight_normal') || 'Normal'}</option>
                                <option value="medium">{t('font_weight_medium') || 'Medium'}</option>
                                <option value="semibold">{t('font_weight_semibold') || 'Semi Bold'}</option>
                                <option value="bold">{t('font_weight_bold') || 'Bold'}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('line_height') || 'Line Height'}
                            </label>
                            <select
                                value={settings.typography.lineHeight}
                                onChange={(e) => updateSettings({
                                    typography: {
                                        ...settings.typography,
                                        lineHeight: e.target.value as any
                                    }
                                })}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                            >
                                <option value="tight">{t('line_height_tight') || 'Tight'}</option>
                                <option value="normal">{t('line_height_normal') || 'Normal'}</option>
                                <option value="relaxed">{t('line_height_relaxed') || 'Relaxed'}</option>
                            </select>
                        </div>
                    </div>
                </SettingsCard>
            )}

            {activeTab === 'layout' && (
                <SettingsCard title={t('layout') || 'Layout'} description={t('layout_desc') || 'Customize page layout and spacing'}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('sidebar_position') || 'Sidebar Position'}
                            </label>
                            <div className="flex gap-2">
                                {(['left', 'right'] as const).map(pos => (
                                    <button
                                        key={pos}
                                        onClick={() => updateSettings({
                                            layout: {
                                                ...settings.layout,
                                                sidebarPosition: pos
                                            }
                                        })}
                                        className={`flex-1 p-3 rounded-lg border-2 ${
                                            settings.layout.sidebarPosition === pos
                                                ? 'border-blue-500 bg-blue-500/20'
                                                : 'border-gray-700 hover:border-gray-600'
                                        }`}
                                    >
                                        {t(`sidebar_${pos}`) || pos}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('sidebar_width') || 'Sidebar Width'}
                            </label>
                            <select
                                value={settings.layout.sidebarWidth}
                                onChange={(e) => updateSettings({
                                    layout: {
                                        ...settings.layout,
                                        sidebarWidth: e.target.value as any
                                    }
                                })}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                            >
                                <option value="narrow">{t('sidebar_width_narrow') || 'Narrow'}</option>
                                <option value="medium">{t('sidebar_width_medium') || 'Medium'}</option>
                                <option value="wide">{t('sidebar_width_wide') || 'Wide'}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('density') || 'Density'}
                            </label>
                            <select
                                value={settings.layout.density}
                                onChange={(e) => updateSettings({
                                    layout: {
                                        ...settings.layout,
                                        density: e.target.value as any
                                    }
                                })}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                            >
                                <option value="comfortable">{t('density_comfortable') || 'Comfortable'}</option>
                                <option value="compact">{t('density_compact') || 'Compact'}</option>
                                <option value="spacious">{t('density_spacious') || 'Spacious'}</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                            <div>
                                <div className="font-semibold text-white">{t('compact_mode') || 'Compact Mode'}</div>
                                <div className="text-xs text-gray-400">{t('compact_mode_desc') || 'Reduce spacing for more content'}</div>
                            </div>
                            <ToggleSwitch
                                enabled={settings.layout.compactMode}
                                onToggle={(val) => updateSettings({
                                    layout: {
                                        ...settings.layout,
                                        compactMode: val
                                    }
                                })}
                            />
                        </div>
                    </div>
                </SettingsCard>
            )}

            {activeTab === 'display' && (
                <SettingsCard title={t('display') || 'Display'} description={t('display_desc') || 'Customize display preferences'}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                            <div>
                                <div className="font-semibold text-white">{t('show_animations') || 'Show Animations'}</div>
                                <div className="text-xs text-gray-400">{t('show_animations_desc') || 'Enable smooth transitions and animations'}</div>
                            </div>
                            <ToggleSwitch
                                enabled={settings.display.showAnimations}
                                onToggle={(val) => updateSettings({
                                    display: {
                                        ...settings.display,
                                        showAnimations: val
                                    }
                                })}
                            />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                            <div>
                                <div className="font-semibold text-white">{t('reduce_motion') || 'Reduce Motion'}</div>
                                <div className="text-xs text-gray-400">{t('reduce_motion_desc') || 'Respect prefers-reduced-motion setting'}</div>
                            </div>
                            <ToggleSwitch
                                enabled={settings.display.reduceMotion}
                                onToggle={(val) => updateSettings({
                                    display: {
                                        ...settings.display,
                                        reduceMotion: val
                                    }
                                })}
                            />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                            <div>
                                <div className="font-semibold text-white">{t('show_tooltips') || 'Show Tooltips'}</div>
                                <div className="text-xs text-gray-400">{t('show_tooltips_desc') || 'Display helpful tooltips on hover'}</div>
                            </div>
                            <ToggleSwitch
                                enabled={settings.display.showTooltips}
                                onToggle={(val) => updateSettings({
                                    display: {
                                        ...settings.display,
                                        showTooltips: val
                                    }
                                })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('chart_style') || 'Chart Style'}
                            </label>
                            <select
                                value={settings.display.chartStyle}
                                onChange={(e) => updateSettings({
                                    display: {
                                        ...settings.display,
                                        chartStyle: e.target.value as any
                                    }
                                })}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                            >
                                <option value="line">{t('chart_line') || 'Line'}</option>
                                <option value="candlestick">{t('chart_candlestick') || 'Candlestick'}</option>
                                <option value="area">{t('chart_area') || 'Area'}</option>
                                <option value="bar">{t('chart_bar') || 'Bar'}</option>
                            </select>
                        </div>
                    </div>
                </SettingsCard>
            )}

            {activeTab === 'dashboard' && (
                <SettingsCard title={t('dashboard') || 'Dashboard'} description={t('dashboard_desc') || 'Customize your dashboard view'}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('default_view') || 'Default View'}
                            </label>
                            <select
                                value={settings.dashboard.defaultView}
                                onChange={(e) => updateSettings({
                                    dashboard: {
                                        ...settings.dashboard,
                                        defaultView: e.target.value as any
                                    }
                                })}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                            >
                                <option value="overview">{t('view_overview') || 'Overview'}</option>
                                <option value="trading">{t('view_trading') || 'Trading'}</option>
                                <option value="portfolio">{t('view_portfolio') || 'Portfolio'}</option>
                                <option value="analytics">{t('view_analytics') || 'Analytics'}</option>
                            </select>
                        </div>
                        {(['showWelcomeMessage', 'showQuickActions', 'showMarketOverview', 'showRecentActivity'] as const).map(key => (
                            <div key={key} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                <div>
                                    <div className="font-semibold text-white">{t(key) || key}</div>
                                    <div className="text-xs text-gray-400">{t(`${key}_desc`) || `Toggle ${key}`}</div>
                                </div>
                                <ToggleSwitch
                                    enabled={settings.dashboard[key]}
                                    onToggle={(val) => updateSettings({
                                        dashboard: {
                                            ...settings.dashboard,
                                            [key]: val
                                        }
                                    })}
                                />
                            </div>
                        ))}
                    </div>
                </SettingsCard>
            )}

            {activeTab === 'notifications' && (
                <SettingsCard title={t('notifications') || 'Notifications'} description={t('notifications_display_desc') || 'Customize notification display'}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('notification_position') || 'Position'}
                            </label>
                            <select
                                value={settings.notifications.position}
                                onChange={(e) => updateSettings({
                                    notifications: {
                                        ...settings.notifications,
                                        position: e.target.value as any
                                    }
                                })}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                            >
                                <option value="top-right">{t('position_top_right') || 'Top Right'}</option>
                                <option value="top-left">{t('position_top_left') || 'Top Left'}</option>
                                <option value="bottom-right">{t('position_bottom_right') || 'Bottom Right'}</option>
                                <option value="bottom-left">{t('position_bottom_left') || 'Bottom Left'}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {t('notification_duration') || 'Duration (ms)'}
                            </label>
                            <input
                                type="number"
                                value={settings.notifications.duration}
                                onChange={(e) => updateSettings({
                                    notifications: {
                                        ...settings.notifications,
                                        duration: parseInt(e.target.value)
                                    }
                                })}
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                min="1000"
                                max="30000"
                                step="500"
                            />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                            <div>
                                <div className="font-semibold text-white">{t('show_icons') || 'Show Icons'}</div>
                            </div>
                            <ToggleSwitch
                                enabled={settings.notifications.showIcons}
                                onToggle={(val) => updateSettings({
                                    notifications: {
                                        ...settings.notifications,
                                        showIcons: val
                                    }
                                })}
                            />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                            <div>
                                <div className="font-semibold text-white">{t('show_progress') || 'Show Progress'}</div>
                            </div>
                            <ToggleSwitch
                                enabled={settings.notifications.showProgress}
                                onToggle={(val) => updateSettings({
                                    notifications: {
                                        ...settings.notifications,
                                        showProgress: val
                                    }
                                })}
                            />
                        </div>
                    </div>
                </SettingsCard>
            )}

            {activeTab === 'accessibility' && (
                <SettingsCard title={t('accessibility') || 'Accessibility'} description={t('accessibility_desc') || 'Improve accessibility and usability'}>
                    <div className="space-y-4">
                        {(['highContrast', 'largeText', 'screenReader', 'keyboardNavigation'] as const).map(key => (
                            <div key={key} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                <div>
                                    <div className="font-semibold text-white">{t(key) || key}</div>
                                    <div className="text-xs text-gray-400">{t(`${key}_desc`) || `Toggle ${key}`}</div>
                                </div>
                                <ToggleSwitch
                                    enabled={settings.accessibility[key]}
                                    onToggle={(val) => updateSettings({
                                        accessibility: {
                                            ...settings.accessibility,
                                            [key]: val
                                        }
                                    })}
                                />
                            </div>
                        ))}
                    </div>
                </SettingsCard>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-800">
                <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-md transition-colors"
                >
                    {t('reset_to_default') || 'Reset to Default'}
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors disabled:opacity-50"
                >
                    {isSaving ? (t('saving') || 'Saving...') : (t('save_changes') || 'Save Changes')}
                </button>
            </div>
        </div>
    );
};

// Toggle Switch Component
const ToggleSwitch: React.FC<{ enabled: boolean; onToggle: (enabled: boolean) => void }> = ({ enabled, onToggle }) => (
    <button
        onClick={() => onToggle(!enabled)}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
            enabled ? 'bg-blue-600' : 'bg-gray-600'
        }`}
    >
        <span
            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
        />
    </button>
);

export default AppearanceSettings;
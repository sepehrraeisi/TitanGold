import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { authenticatedFetch } from '../../../services/api-auth';

interface SecurityConfig {
  allowEmailLogin: boolean;
  jwtExpiryHours: number;
  maxLoginAttempts: number;
  lockoutMinutes: number;
}

interface SecurityMetadata {
  config: SecurityConfig;
  description: string;
  updated_at: string;
  updated_by: string;
}

const Security: React.FC = () => {
  const { t } = useLanguage();
  
  const [config, setConfig] = useState<SecurityConfig>({
    allowEmailLogin: true,
    jwtExpiryHours: 24,
    maxLoginAttempts: 10,
    lockoutMinutes: 15
  });
  
  const [originalConfig, setOriginalConfig] = useState<SecurityConfig | null>(null);
  const [metadata, setMetadata] = useState<Pick<SecurityMetadata, 'updated_at' | 'updated_by'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Load config
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await authenticatedFetch('/config/security', {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Failed to load security configuration');
      }

      const data: SecurityMetadata = await response.json();
      
      if (data.success && data.config) {
        setConfig(data.config);
        setOriginalConfig(data.config);
        setMetadata({
          updated_at: data.updated_at,
          updated_by: data.updated_by
        });
      }
    } catch (err) {
      console.error('Error loading security config:', err);
      setError(t('Failed to load security configuration'));
    } finally {
      setLoading(false);
    }
  };

  const validateConfig = (): boolean => {
    const errors: Record<string, string> = {};

    // JWT Expiry Hours: 1-168 (1 hour to 7 days)
    if (config.jwtExpiryHours < 1 || config.jwtExpiryHours > 168) {
      errors.jwtExpiryHours = t('JWT expiry must be between 1 and 168 hours');
    }

    // Max Login Attempts: 1-50
    if (config.maxLoginAttempts < 1 || config.maxLoginAttempts > 50) {
      errors.maxLoginAttempts = t('Max login attempts must be between 1 and 50');
    }

    // Lockout Minutes: 1-120 (2 hours max)
    if (config.lockoutMinutes < 1 || config.lockoutMinutes > 120) {
      errors.lockoutMinutes = t('Lockout duration must be between 1 and 120 minutes');
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!validateConfig()) {
      setError(t('Please fix validation errors'));
      return;
    }

    setSaving(true);

    try {
      const response = await authenticatedFetch('/config/security', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      if (data.success) {
        setSuccess(t('Security configuration saved successfully'));
        setOriginalConfig(config);
        // Reload to get updated metadata
        await loadConfig();
      }
    } catch (err: any) {
      console.error('Error saving security config:', err);
      setError(err.message || t('Failed to save security configuration'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (originalConfig) {
      setConfig(originalConfig);
      setValidationErrors({});
      setError(null);
      setSuccess(null);
    }
  };

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {t('Security Settings')}
        </h2>
        <p className="text-gray-400 text-sm">
          {t('Configure authentication, session management, and access controls')}
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
          <p className="text-green-400 text-sm">{success}</p>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-gray-800/50 rounded-xl p-6 space-y-6 border border-gray-700/50">
        
        {/* Allow Email Login */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-200 mb-1">
              {t('Allow Email Login')}
            </label>
            <p className="text-xs text-gray-400">
              {t('Enable users to login with email address in addition to username')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfig({ ...config, allowEmailLogin: !config.allowEmailLogin })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.allowEmailLogin ? 'bg-yellow-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.allowEmailLogin ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* JWT Expiry Hours */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            {t('JWT Token Expiry (hours)')}
          </label>
          <input
            type="number"
            min="1"
            max="168"
            value={config.jwtExpiryHours}
            onChange={(e) => setConfig({ ...config, jwtExpiryHours: parseInt(e.target.value) || 1 })}
            className={`w-full bg-gray-900/50 border ${
              validationErrors.jwtExpiryHours ? 'border-red-500' : 'border-gray-700'
            } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500`}
          />
          {validationErrors.jwtExpiryHours && (
            <p className="mt-1 text-xs text-red-400">{validationErrors.jwtExpiryHours}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {t('Duration before user tokens expire (1-168 hours)')}
          </p>
        </div>

        {/* Max Login Attempts */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            {t('Max Login Attempts')}
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={config.maxLoginAttempts}
            onChange={(e) => setConfig({ ...config, maxLoginAttempts: parseInt(e.target.value) || 1 })}
            className={`w-full bg-gray-900/50 border ${
              validationErrors.maxLoginAttempts ? 'border-red-500' : 'border-gray-700'
            } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500`}
          />
          {validationErrors.maxLoginAttempts && (
            <p className="mt-1 text-xs text-red-400">{validationErrors.maxLoginAttempts}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {t('Number of failed login attempts before account lockout (1-50)')}
          </p>
        </div>

        {/* Lockout Minutes */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-2">
            {t('Lockout Duration (minutes)')}
          </label>
          <input
            type="number"
            min="1"
            max="120"
            value={config.lockoutMinutes}
            onChange={(e) => setConfig({ ...config, lockoutMinutes: parseInt(e.target.value) || 1 })}
            className={`w-full bg-gray-900/50 border ${
              validationErrors.lockoutMinutes ? 'border-red-500' : 'border-gray-700'
            } rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500`}
          />
          {validationErrors.lockoutMinutes && (
            <p className="mt-1 text-xs text-red-400">{validationErrors.lockoutMinutes}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {t('Duration to lock account after max failed attempts (1-120 minutes)')}
          </p>
        </div>

        {/* Metadata */}
        {metadata && (
          <div className="pt-4 border-t border-gray-700/50">
            <p className="text-xs text-gray-400">
              {t('Last updated')}: {new Date(metadata.updated_at).toLocaleString()}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex-1 px-6 py-2.5 rounded-lg font-medium transition-all ${
              saving || !hasChanges
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-yellow-500 text-gray-900 hover:bg-yellow-400'
            }`}
          >
            {saving ? t('Saving...') : t('Save Changes')}
          </button>
          
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              !hasChanges
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
          >
            {t('Reset')}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-400 mb-2">
          ℹ️ {t('Security Notes')}
        </h3>
        <ul className="text-xs text-blue-300/80 space-y-1">
          <li>• {t('Changes take effect for new login sessions')}</li>
          <li>• {t('Existing sessions remain valid until their original expiry')}</li>
          <li>• {t('Account lockout is reset after the lockout duration expires')}</li>
          <li>• {t('Admin users can only modify these settings')}</li>
        </ul>
      </div>
    </div>
  );
};

export default Security;

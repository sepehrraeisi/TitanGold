import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { getAuthToken, authenticatedFetch } from '../../../services/api-auth.ts';

interface QuorumConfig {
  type: 'percent' | 'absolute';
  value: number;
  min: number;
}

interface AggregationConfig {
  method: string;
  finalSummarizer: boolean;
}

interface ArtemisConfig {
  strategy: string;
  quorum: QuorumConfig;
  timeoutMs: number;
  maxRetries: number;
  maxConcurrency: number;
  providersToUse: string[];
  degradedMode: string;
  aggregation: AggregationConfig;
}

interface ConfigResponse {
  success: boolean;
  config: ArtemisConfig;
  description?: string;
  updated_at?: string;
  updated_by?: string;
}

const DecisionEngine: React.FC = () => {
  const { language, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ArtemisConfig | null>(null);
  const [metadata, setMetadata] = useState<{ updated_at?: string; updated_by?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const STRATEGIES = ['mixture_of_experts', 'weighted_vote', 'majority'];
  const QUORUM_TYPES = ['percent', 'absolute'];
  const PROVIDERS = ['gemini', 'openai', 'anthropic', 'deepseek', 'openrouter'];
  const AGGREGATION_METHODS = ['weighted_vote', 'majority', 'consensus'];

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await authenticatedFetch('/config/artemis');

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }

      const data: ConfigResponse = await response.json();

      if (data.success && data.config) {
        setConfig(data.config);
        setMetadata({
          updated_at: data.updated_at,
          updated_by: data.updated_by,
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateConfig = (): boolean => {
    const errors: Record<string, string> = {};

    if (!config) {
      errors.general = 'Configuration is missing';
      setFormErrors(errors);
      return false;
    }

    // Validate strategy
    if (!STRATEGIES.includes(config.strategy)) {
      errors.strategy = `Invalid strategy. Must be one of: ${STRATEGIES.join(', ')}`;
    }

    // Validate quorum
    if (config.quorum.type === 'percent') {
      if (config.quorum.value < 0 || config.quorum.value > 100) {
        errors.quorum = 'Quorum percent must be between 0 and 100';
      }
    } else if (config.quorum.type === 'absolute') {
      if (config.quorum.value < 1) {
        errors.quorum = 'Quorum absolute must be at least 1';
      }
    }

    if (config.quorum.min < 1) {
      errors.quorumMin = 'Quorum minimum must be at least 1';
    }

    // Validate timeouts
    if (config.timeoutMs < 1000 || config.timeoutMs > 60000) {
      errors.timeout = 'Timeout must be between 1000ms and 60000ms';
    }

    // Validate retries
    if (config.maxRetries < 0 || config.maxRetries > 10) {
      errors.retries = 'Max retries must be between 0 and 10';
    }

    // Validate concurrency
    if (config.maxConcurrency < 1 || config.maxConcurrency > 20) {
      errors.concurrency = 'Max concurrency must be between 1 and 20';
    }

    // Validate providers
    if (!config.providersToUse || config.providersToUse.length === 0) {
      errors.providers = 'At least one provider must be selected';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!config) return;

    if (!validateConfig()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await authenticatedFetch('/config/artemis', {
        method: 'PUT',
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.errors && Array.isArray(data.errors)) {
          setError(data.errors.join(', '));
        } else {
          setError(data.error || 'Failed to save configuration');
        }
        return;
      }

      alert('✅ Configuration saved successfully');
      await fetchConfig(); // Reload to get updated metadata
    } catch (err: any) {
      setError(err.message);
      console.error('Error saving config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset configuration to last saved state?')) {
      fetchConfig();
      setFormErrors({});
    }
  };

  const updateConfig = (updates: Partial<ArtemisConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...updates });
    setFormErrors({}); // Clear errors on change
  };

  const updateQuorum = (updates: Partial<QuorumConfig>) => {
    if (!config) return;
    setConfig({
      ...config,
      quorum: { ...config.quorum, ...updates },
    });
    setFormErrors({});
  };

  const toggleProvider = (provider: string) => {
    if (!config) return;
    const providers = config.providersToUse.includes(provider)
      ? config.providersToUse.filter(p => p !== provider)
      : [...config.providersToUse, provider];
    updateConfig({ providersToUse: providers });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-400">Loading configuration...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-red-400">Failed to load configuration</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">
          {language === 'fa' ? 'موتور تصمیم‌گیری Artemis' : 'Artemis Decision Engine'}
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          {language === 'fa'
            ? 'تنظیمات استراتژی، کوئروم، و ارائه‌دهندگان'
            : 'Configure strategy, quorum, and provider selection'}
        </p>
        {metadata.updated_at && (
          <p className="text-xs text-gray-500 mt-1">
            Last updated: {new Date(metadata.updated_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6 space-y-6">
        {/* Strategy */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Strategy
          </label>
          <select
            value={config.strategy}
            onChange={(e) => updateConfig({ strategy: e.target.value })}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          >
            {STRATEGIES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {formErrors.strategy && (
            <p className="text-xs text-red-400 mt-1">{formErrors.strategy}</p>
          )}
        </div>

        {/* Quorum */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Quorum Type
            </label>
            <select
              value={config.quorum.type}
              onChange={(e) => updateQuorum({ type: e.target.value as 'percent' | 'absolute' })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              {QUORUM_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Quorum Value
            </label>
            <input
              type="number"
              value={config.quorum.value}
              onChange={(e) => updateQuorum({ value: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            {formErrors.quorum && (
              <p className="text-xs text-red-400 mt-1">{formErrors.quorum}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Minimum Required
            </label>
            <input
              type="number"
              min="1"
              value={config.quorum.min}
              onChange={(e) => updateQuorum({ min: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            {formErrors.quorumMin && (
              <p className="text-xs text-red-400 mt-1">{formErrors.quorumMin}</p>
            )}
          </div>
        </div>

        {/* Timeouts & Retries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Timeout (ms)
            </label>
            <input
              type="number"
              step="1000"
              min="1000"
              max="60000"
              value={config.timeoutMs}
              onChange={(e) => updateConfig({ timeoutMs: parseInt(e.target.value) || 12000 })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            {formErrors.timeout && (
              <p className="text-xs text-red-400 mt-1">{formErrors.timeout}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Retries
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={config.maxRetries}
              onChange={(e) => updateConfig({ maxRetries: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            {formErrors.retries && (
              <p className="text-xs text-red-400 mt-1">{formErrors.retries}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Concurrency
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={config.maxConcurrency}
              onChange={(e) => updateConfig({ maxConcurrency: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
            {formErrors.concurrency && (
              <p className="text-xs text-red-400 mt-1">{formErrors.concurrency}</p>
            )}
          </div>
        </div>

        {/* Providers Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Providers to Use
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {PROVIDERS.map(provider => (
              <button
                key={provider}
                onClick={() => toggleProvider(provider)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  config.providersToUse.includes(provider)
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {provider}
              </button>
            ))}
          </div>
          {formErrors.providers && (
            <p className="text-xs text-red-400 mt-1">{formErrors.providers}</p>
          )}
        </div>

        {/* Degraded Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Degraded Mode
          </label>
          <input
            type="text"
            value={config.degradedMode}
            onChange={(e) => updateConfig({ degradedMode: e.target.value })}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Behavior when quorum is not met (e.g., best_effort, fail_safe)
          </p>
        </div>

        {/* Aggregation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Aggregation Method
            </label>
            <select
              value={config.aggregation.method}
              onChange={(e) => updateConfig({
                aggregation: { ...config.aggregation, method: e.target.value }
              })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              {AGGREGATION_METHODS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.aggregation.finalSummarizer}
                onChange={(e) => updateConfig({
                  aggregation: { ...config.aggregation, finalSummarizer: e.target.checked }
                })}
                className="w-5 h-5 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">Use Final Summarizer</span>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleReset}
          disabled={saving}
          className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '⏳ Saving...' : '💾 Save Configuration'}
        </button>
      </div>
    </div>
  );
};

export default DecisionEngine;

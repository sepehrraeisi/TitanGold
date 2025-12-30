import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import { getAuthToken, authenticatedFetch } from '../../../services/api-auth.ts';

interface Integration {
  id: string;
  provider: string;
  name: string;
  model: string;
  weight: number;
  enabled: boolean;
  api_key_masked: string;
  base_url?: string;
  rate_limit_per_min?: number;
  daily_budget?: number;
  monthly_budget?: number;
  status: 'healthy' | 'rate_limited' | 'quota_exhausted' | 'auth_failed' | 'disabled' | 'timeout';
  cooldown_until?: string | null;
  fail_count: number;
  success_count: number;
  total_requests: number;
  last_error?: string | null;
  last_error_at?: string | null;
}

interface TestResult {
  success: boolean;
  provider: string;
  name: string;
  healthy: boolean;
  message: string;
  responseTime?: string;
}

interface IntegrationFormData {
  provider: string;
  name: string;
  api_key: string;
  base_url?: string;
  model?: string;
  weight?: number;
  rate_limit_per_min?: number;
  daily_budget?: number;
  monthly_budget?: number;
}

const Integrations: React.FC = () => {
  const { language, t } = useLanguage();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [formData, setFormData] = useState<IntegrationFormData>({
    provider: 'openai',
    name: '',
    api_key: '',
    base_url: '',
    model: '',
    weight: 1.0,
    rate_limit_per_min: 60,
    daily_budget: 10,
    monthly_budget: 100,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const PROVIDERS = ['gemini', 'openai', 'anthropic', 'deepseek', 'openrouter'];

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }

      const response = await authenticatedFetch('/config/integrations');

      if (!response.ok) {
        throw new Error(`Failed to fetch integrations: ${response.statusText}`);
      }

      const data = await response.json();
      setIntegrations(data.integrations || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchIntegrations, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const response = await authenticatedFetch(`/config/integrations/${id}/test`, {
        method: 'POST',
      });

      const result: TestResult = await response.json();
      
      if (result.success && result.healthy) {
        alert(`✅ ${result.provider} - ${result.name}\n${result.message}\n${result.responseTime || ''}`);
      } else {
        alert(`❌ ${result.provider} - ${result.name}\n${result.message}\n${result.responseTime || ''}`);
      }

      await fetchIntegrations();
    } catch (err: any) {
      alert(`Error testing integration: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleDisable = async (id: string) => {
    if (!confirm('Are you sure you want to disable this integration?')) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/config/integrations/${id}/disable`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disable integration');
      }

      alert('✅ Integration disabled');
      await fetchIntegrations();
    } catch (err: any) {
      alert(`Error disabling integration: ${err.message}`);
    }
  };

  const handleResetRuntime = async (id: string) => {
    if (!confirm('Reset runtime status for this integration?')) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/config/integrations/${id}/reset-runtime`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reset runtime');
      }

      alert('✅ Runtime status reset');
      await fetchIntegrations();
    } catch (err: any) {
      alert(`Error resetting runtime: ${err.message}`);
    }
  };

  const openAddModal = () => {
    setEditingIntegration(null);
    setFormData({
      provider: 'openai',
      name: '',
      api_key: '',
      base_url: '',
      model: '',
      weight: 1.0,
      rate_limit_per_min: 60,
      daily_budget: 10,
      monthly_budget: 100,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (integration: Integration) => {
    setEditingIntegration(integration);
    setFormData({
      provider: integration.provider,
      name: integration.name,
      api_key: '', // Don't populate API key for security
      base_url: integration.base_url || '',
      model: integration.model || '',
      weight: integration.weight || 1.0,
      rate_limit_per_min: integration.rate_limit_per_min || 60,
      daily_budget: integration.daily_budget || 10,
      monthly_budget: integration.monthly_budget || 100,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingIntegration(null);
    setFormData({
      provider: 'openai',
      name: '',
      api_key: '',
      base_url: '',
      model: '',
      weight: 1.0,
      rate_limit_per_min: 60,
      daily_budget: 10,
      monthly_budget: 100,
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!editingIntegration && !formData.api_key.trim()) {
      errors.api_key = 'API Key is required for new integrations';
    }

    if (!PROVIDERS.includes(formData.provider)) {
      errors.provider = 'Invalid provider selected';
    }

    if (formData.weight !== undefined && (formData.weight < 0 || formData.weight > 10)) {
      errors.weight = 'Weight must be between 0 and 10';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      if (editingIntegration) {
        // PATCH for update
        const updatePayload: any = {
          name: formData.name,
          base_url: formData.base_url || undefined,
          model: formData.model || undefined,
          weight: formData.weight,
          rate_limit_per_min: formData.rate_limit_per_min,
          daily_budget: formData.daily_budget,
          monthly_budget: formData.monthly_budget,
        };

        // Only include API key if it was changed
        if (formData.api_key.trim()) {
          updatePayload.api_key = formData.api_key;
        }

        const response = await authenticatedFetch(`/config/integrations/${editingIntegration.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updatePayload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update integration');
        }

        alert('✅ Integration updated successfully');
      } else {
        // POST for create
        const createPayload = {
          provider: formData.provider,
          name: formData.name,
          api_key: formData.api_key,
          base_url: formData.base_url || undefined,
          model: formData.model || undefined,
          weight: formData.weight,
          rate_limit_per_min: formData.rate_limit_per_min,
          daily_budget: formData.daily_budget,
          monthly_budget: formData.monthly_budget,
        };

        const response = await authenticatedFetch('/config/integrations', {
          method: 'POST',
          body: JSON.stringify(createPayload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create integration');
        }

        const result = await response.json();
        alert(`✅ Integration created successfully (ID: ${result.integration_id})`);
      }

      closeModal();
      await fetchIntegrations();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      console.error('Form submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      healthy: { label: '✅ Healthy', className: 'bg-green-500/20 text-green-300 border-green-500/40' },
      rate_limited: { label: '⚠️ Rate Limited', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
      quota_exhausted: { label: '🚫 Quota Exhausted', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
      auth_failed: { label: '🔒 Auth Failed', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
      disabled: { label: '⭕ Disabled', className: 'bg-gray-500/20 text-gray-400 border-gray-500/40' },
      timeout: { label: '⏱️ Timeout', className: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
    };

    const badge = statusMap[status] || { label: status, className: 'bg-gray-500/20 text-gray-400 border-gray-500/40' };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  if (loading && integrations.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-400">Loading integrations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {language === 'fa' ? 'یکپارچه‌سازی‌های API' : 'API Integrations'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {language === 'fa' 
              ? 'مدیریت کلیدهای API و تنظیمات ارائه‌دهندگان' 
              : 'Manage API keys and provider settings'}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          {language === 'fa' ? '+ افزودن یکپارچه‌سازی' : '+ Add Integration'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Integrations Table */}
      <div className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Provider</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Model</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Stats</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">API Key</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {integrations.map((integration) => (
              <tr key={integration.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{integration.provider}</span>
                    <span className={`w-2 h-2 rounded-full ${integration.enabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-300">{integration.name}</td>
                <td className="px-4 py-4">
                  <code className="text-xs bg-gray-800 px-2 py-1 rounded text-blue-300">
                    {integration.model || 'default'}
                  </code>
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    {getStatusBadge(integration.status)}
                    {integration.cooldown_until && new Date(integration.cooldown_until) > new Date() && (
                      <div className="text-xs text-yellow-400">
                        Cooldown: {new Date(integration.cooldown_until).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-xs space-y-1">
                    <div className="text-green-400">✓ {integration.success_count}</div>
                    <div className="text-red-400">✗ {integration.fail_count}</div>
                    <div className="text-gray-500">Total: {integration.total_requests}</div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <code className="text-xs text-gray-400 font-mono">
                    {integration.api_key_masked || '(none)'}
                  </code>
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleTest(integration.id)}
                      disabled={testingId === integration.id}
                      className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {testingId === integration.id ? '⏳' : '🧪 Test'}
                    </button>
                    <button
                      onClick={() => openEditModal(integration)}
                      className="px-3 py-1 bg-gray-700/40 hover:bg-gray-700/60 text-gray-300 rounded text-xs font-medium transition-colors"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDisable(integration.id)}
                      className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded text-xs font-medium transition-colors"
                    >
                      🚫 Disable
                    </button>
                    <button
                      onClick={() => handleResetRuntime(integration.id)}
                      className="px-3 py-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded text-xs font-medium transition-colors"
                    >
                      🔄 Reset
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {integrations.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            No integrations found. Add your first integration to get started.
          </div>
        )}
      </div>

      {/* Error Details */}
      {integrations.some(i => i.last_error) && (
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
          <h3 className="text-white font-semibold mb-3">Recent Errors</h3>
          <div className="space-y-2">
            {integrations
              .filter(i => i.last_error)
              .map(integration => (
                <div key={integration.id} className="text-xs bg-red-500/10 border border-red-500/30 rounded p-3">
                  <div className="font-semibold text-red-300 mb-1">
                    {integration.provider} - {integration.name}
                  </div>
                  <div className="text-red-200">{integration.last_error}</div>
                  {integration.last_error_at && (
                    <div className="text-red-400 mt-1">
                      {new Date(integration.last_error_at).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">
                  {editingIntegration ? 'Edit Integration' : 'Add New Integration'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Provider *
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  disabled={!!editingIntegration}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-blue-500"
                >
                  {PROVIDERS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {editingIntegration && (
                  <p className="text-xs text-gray-500 mt-1">Provider cannot be changed after creation</p>
                )}
                {formErrors.provider && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.provider}</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., OpenAI Primary"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                {formErrors.name && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  API Key {!editingIntegration && '*'}
                </label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder={editingIntegration ? 'Leave blank to keep existing key' : 'sk-...'}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                {editingIntegration && (
                  <p className="text-xs text-gray-500 mt-1">Leave blank to keep existing key</p>
                )}
                {formErrors.api_key && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.api_key}</p>
                )}
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Model
                </label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g., gpt-4o-mini (leave blank for default)"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Base URL
                </label>
                <input
                  type="url"
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  placeholder="e.g., https://api.openai.com/v1 (leave blank for default)"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Weight (0-10)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                {formErrors.weight && (
                  <p className="text-xs text-red-400 mt-1">{formErrors.weight}</p>
                )}
              </div>

              {/* Rate Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rate Limit (requests/min)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.rate_limit_per_min}
                  onChange={(e) => setFormData({ ...formData, rate_limit_per_min: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Daily Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Daily Budget ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.daily_budget}
                  onChange={(e) => setFormData({ ...formData, daily_budget: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Monthly Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Monthly Budget ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monthly_budget}
                  onChange={(e) => setFormData({ ...formData, monthly_budget: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>⏳ {editingIntegration ? 'Updating...' : 'Creating...'}</>
                  ) : (
                    <>{editingIntegration ? 'Update Integration' : 'Create Integration'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Integrations;

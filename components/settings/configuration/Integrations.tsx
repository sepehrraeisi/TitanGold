import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../context/LanguageContext.tsx';

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

const Integrations: React.FC = () => {
  const { language, t } = useLanguage();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);

  const API_BASE = 'https://titan.zala.ir/api';

  const getAuthToken = (): string | null => {
    return localStorage.getItem('authToken');
  };

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE}/config/integrations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

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
      const token = getAuthToken();
      if (!token) {
        alert('No authentication token');
        return;
      }

      const response = await fetch(`${API_BASE}/config/integrations/${id}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result: TestResult = await response.json();
      
      if (result.success && result.healthy) {
        alert(`✅ ${result.provider} - ${result.name}\n${result.message}\n${result.responseTime || ''}`);
      } else {
        alert(`❌ ${result.provider} - ${result.name}\n${result.message}\n${result.responseTime || ''}`);
      }

      // Refresh integrations after test
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
      const token = getAuthToken();
      if (!token) {
        alert('No authentication token');
        return;
      }

      const response = await fetch(`${API_BASE}/config/integrations/${id}/disable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
      const token = getAuthToken();
      if (!token) {
        alert('No authentication token');
        return;
      }

      const response = await fetch(`${API_BASE}/config/integrations/${id}/reset-runtime`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
          onClick={() => setShowAddModal(true)}
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
                      onClick={() => setEditingIntegration(integration)}
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

      {/* TODO: Add/Edit Modal */}
      {(showAddModal || editingIntegration) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 max-w-2xl w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingIntegration ? 'Edit Integration' : 'Add New Integration'}
            </h3>
            <p className="text-gray-400 mb-4">
              This feature is coming soon. Use the backend API directly for now.
            </p>
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingIntegration(null);
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Integrations;

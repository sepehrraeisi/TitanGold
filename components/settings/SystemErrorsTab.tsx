import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { isAdminRole } from '../../utils/auth';
import { fetchSystemErrors } from '../../services/api-backend';
import type { SystemError } from '../../types';

const safeString = (v: any) => (v === null || v === undefined ? '' : String(v));

const SystemErrorsTab: React.FC = () => {
  const { user } = useAppContext();
  const { t } = useLanguage();

  const isAdmin = isAdminRole(user?.role);

  const [limit, setLimit] = useState<number>(50);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<SystemError[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [contextFilter, setContextFilter] = useState<string>('all');
  const [loadError, setLoadError] = useState<string>('');

  const contexts = useMemo(() => {
    const set = new Set<string>();
    errors.forEach(e => {
      const c = safeString(e.context).trim();
      if (c) set.add(c);
    });
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [errors]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return errors.filter(e => {
      if (contextFilter !== 'all' && safeString(e.context) !== contextFilter) return false;
      if (!query) return true;
      const hay = [
        e.id,
        e.context,
        e.message,
        e.stack,
        e.timestamp,
        JSON.stringify(e.meta || {}),
      ]
        .map(safeString)
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }, [errors, q, contextFilter]);

  const load = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await fetchSystemErrors(limit);
      setErrors(data);
    } catch (e: any) {
      setErrors([]);
      setLoadError(e?.message || 'Failed to load system errors');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, limit]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-errors-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">
          {t?.('admin_only') || 'Admin Only'}
        </h3>
        <p className="text-gray-400">
          {t?.('system_errors_admin_only') || 'You do not have access to system error logs.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-200">
            {t?.('system_errors') || 'System Errors'}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {t?.('system_errors_desc') || 'Admin-only errors from /api/monitoring/errors'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {isLoading ? (t?.('loading') || 'Loading...') : (t?.('refresh') || 'Refresh')}
          </button>
          <button
            onClick={exportJson}
            disabled={filtered.length === 0}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {t?.('export_json') || 'Export JSON'}
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap items-center">
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{t?.('limit') || 'Limit'}:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {[25, 50, 100, 200].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{t?.('context') || 'Context'}:</span>
          <select
            value={contextFilter}
            onChange={(e) => setContextFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {contexts.map(c => (
              <option key={c} value={c}>{c === 'all' ? (t?.('all') || 'All') : c}</option>
            ))}
          </select>
        </label>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t?.('search') || 'Search...'}
          className="flex-1 min-w-[220px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {loadError ? (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">
            <span className="font-semibold">{t?.('error') || 'Error'}:</span> {loadError}
          </p>
        </div>
      ) : null}

      <div className="mb-4 text-sm text-gray-400">
        {t?.('results') || 'Results'}: <span className="text-gray-200 font-medium">{filtered.length}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Context
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Message
              </th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const isOpen = expandedId === e.id;
              return (
                <React.Fragment key={e.id}>
                  <tr className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-300 whitespace-nowrap">
                      {safeString(e.timestamp)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {safeString(e.context)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {safeString(e.message)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setExpandedId(isOpen ? null : e.id)}
                        className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
                      >
                        {isOpen ? (t?.('hide') || 'Hide') : (t?.('details') || 'Details')}
                      </button>
                    </td>
                  </tr>

                  {isOpen ? (
                    <tr>
                      <td colSpan={4} className="py-4 px-4 bg-gray-800/50">
                        <div className="text-xs text-gray-400 mb-3">
                          ID: <span className="text-gray-300 font-mono">{e.id}</span>
                        </div>

                        {e.stack ? (
                          <div className="mb-4">
                            <div className="text-sm font-semibold text-gray-300 mb-2">Stack Trace</div>
                            <pre className="text-xs text-gray-400 bg-gray-900/50 p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                              {safeString(e.stack)}
                            </pre>
                          </div>
                        ) : null}

                        {e.meta ? (
                          <div>
                            <div className="text-sm font-semibold text-gray-300 mb-2">Metadata</div>
                            <pre className="text-xs text-gray-400 bg-gray-900/50 p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono">
                              {JSON.stringify(e.meta, null, 2)}
                            </pre>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}

            {filtered.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">
                  {t?.('no_results') || 'No errors found.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SystemErrorsTab;

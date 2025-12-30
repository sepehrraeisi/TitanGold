import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { isAdminRole } from '../../utils/auth';
import { fetchSystemErrors } from '../../services/api-backend';
import type { SystemError } from '../../types';

type Props = {
  Card: React.ComponentType<any>;
};

const safeString = (v: any) => (v === null || v === undefined ? '' : String(v));

const SystemErrorsTab: React.FC<Props> = ({ Card }) => {
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
      <Card>
        <div style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>{t?.('admin_only') || 'Admin Only'}</h3>
          <p style={{ marginBottom: 0 }}>
            {t?.('system_errors_admin_only') || 'You do not have access to system error logs.'}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>{t?.('system_errors') || 'System Errors'}</h3>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {t?.('system_errors_desc') || 'Admin-only errors from /api/monitoring/errors'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={load} disabled={isLoading}>
              {isLoading ? (t?.('loading') || 'Loading...') : (t?.('refresh') || 'Refresh')}
            </button>
            <button onClick={exportJson} disabled={filtered.length === 0}>
              {t?.('export_json') || 'Export JSON'}
            </button>
          </div>
        </div>

        <hr style={{ margin: '12px 0' }} />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>{t?.('limit') || 'Limit'}:</span>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[25, 50, 100, 200].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>{t?.('context') || 'Context'}:</span>
            <select value={contextFilter} onChange={(e) => setContextFilter(e.target.value)}>
              {contexts.map(c => (
                <option key={c} value={c}>{c === 'all' ? (t?.('all') || 'All') : c}</option>
              ))}
            </select>
          </label>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t?.('search') || 'Search...'}
            style={{ flex: '1 1 260px', minWidth: 220 }}
          />
        </div>

        {loadError ? (
          <div style={{ marginTop: 12, padding: 12, border: '1px solid #f00', borderRadius: 6 }}>
            <b>{t?.('error') || 'Error'}:</b> {loadError}
          </div>
        ) : null}

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>
          {t?.('results') || 'Results'}: {filtered.length}
        </div>

        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Timestamp</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Context</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Message</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const isOpen = expandedId === e.id;
                return (
                  <React.Fragment key={e.id}>
                    <tr>
                      <td style={{ borderBottom: '1px solid #eee', padding: 8, whiteSpace: 'nowrap' }}>
                        {safeString(e.timestamp)}
                      </td>
                      <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                        {safeString(e.context)}
                      </td>
                      <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                        {safeString(e.message)}
                      </td>
                      <td style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'right' }}>
                        <button onClick={() => setExpandedId(isOpen ? null : e.id)}>
                          {isOpen ? (t?.('hide') || 'Hide') : (t?.('details') || 'Details')}
                        </button>
                      </td>
                    </tr>

                    {isOpen ? (
                      <tr>
                        <td colSpan={4} style={{ padding: 10, background: 'rgba(0,0,0,0.03)' }}>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>ID: {e.id}</div>

                          {e.stack ? (
                            <>
                              <div style={{ marginTop: 10, fontWeight: 600 }}>Stack</div>
                              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{safeString(e.stack)}</pre>
                            </>
                          ) : null}

                          {e.meta ? (
                            <>
                              <div style={{ marginTop: 10, fontWeight: 600 }}>Meta</div>
                              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                {JSON.stringify(e.meta, null, 2)}
                              </pre>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}

              {filtered.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={4} style={{ padding: 12, opacity: 0.8 }}>
                    {t?.('no_results') || 'No errors found.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};

export default SystemErrorsTab;

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import {
    DATAHUB_SHELL,
    DATAHUB_INNER_LIST,
    DataHubAlert,
    DataHubEmpty,
    DataHubModal,
    DataHubSectionHeader,
    DataHubSegmentedControl,
    DataHubToolbar,
    DataHubFilterBar,
    DataHubToggle,
    DataHubLoadingSpinner,
    MetricCard,
    PrimaryButton,
    SecondaryButton,
    StatusPill,
    severityVariant,
    sentimentVariant,
} from './dataHubUi';

interface BreakingNews {
  id: string;
  message_id: number;
  channel_id: string;
  channel_username: string;
  channel_title: string;
  cleaned_text: string;
  sentiment: string;
  news_type: string;
  importance_level: string;
  mentioned_assets: string[];
  extracted_prices: any[];
  telegram_created_at: string;
  created_at: string;
  primary_category: string;
  sub_category: string | null;
  regions: string[] | null;
  affected_entities: string[] | null;
  affected_markets: string[] | null;
  affected_assets: string[] | null;
  market_impact_level: string;
  event_urgency: string | null;
  source_reliability: string | null;
  event_type: string | null;
  affected_agents_count: number;
  top_affected_agents: Array<{
    agent_key: string;
    impact_score: string;
    requires_action: boolean;
  }>;
}

interface BreakingNewsMonitorProps {
  t: (key: string) => string;
  Card: React.FC<{ children: React.ReactNode; className?: string }>;
}

const SEVERITY_CONFIG = {
  high: {
    icon: '🚨',
    label: 'CRITICAL',
    border: 'border-l-red-500',
  },
  medium: {
    icon: '⚠️',
    label: 'WARNING',
    border: 'border-l-amber-500',
  },
  low: {
    icon: 'ℹ️',
    label: 'INFO',
    border: 'border-l-emerald-500',
  },
};

const CATEGORY_ICONS: Record<string, string> = {
  'MARKET_DATA': '📊',
  'ECONOMIC_INDICATORS': '📈',
  'GEOPOLITICAL': '🌍',
  'POLITICAL': '🏛️',
  'SANCTIONS_EMBARGO': '⛔',
  'ENERGY_COMMODITIES': '⚡',
  'CRYPTO_BLOCKCHAIN': '₿',
  'FOREX_CURRENCY': '💱',
  'PRECIOUS_METALS': '🥇',
  'SOCIAL_UNREST': '⚠️',
  'NATURAL_DISASTERS': '🌪️',
  'CORPORATE_BUSINESS': '🏢',
  'TECHNOLOGY': '💻',
  'FINANCIAL_CRISIS': '💥',
  'TRADE_COMMERCE': '🚢'
};

const STORAGE_KEY_MIN_IMPACT = 'breaking-news-min-impact';

function getStoredMinImpact(): number {
  if (typeof localStorage === 'undefined') return 0.7;
  try {
    const v = localStorage.getItem(STORAGE_KEY_MIN_IMPACT);
    if (v == null) return 0.7;
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.7;
  } catch {
    return 0.7;
  }
}

const BreakingNewsMonitor: React.FC<BreakingNewsMonitorProps> = ({ t, Card }) => {
  const [news, setNews] = useState<BreakingNews[]>([]);
  const [filteredNews, setFilteredNews] = useState<BreakingNews[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date>(new Date());
  
  // Min Impact persisted in localStorage so it doesn't reset when tab changes or component remounts
  const [minImpact, setMinImpactState] = useState(getStoredMinImpact);
  const setMinImpact = useCallback((value: number | ((prev: number) => number)) => {
    setMinImpactState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      const clamped = Math.max(0, Math.min(1, next));
      try {
        localStorage.setItem(STORAGE_KEY_MIN_IMPACT, String(clamped));
      } catch (_) {}
      return clamped;
    });
  }, []);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedNews, setSelectedNews] = useState<BreakingNews | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const previousNewsIds = useRef<Set<string>>(new Set());

  const getAuthHeaders = () => {
    const token =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token')
        : null;
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  // Fetch breaking news
  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/v1/telegram/breaking-news?minImpact=${minImpact}&limit=50`;
      if (severityFilter) {
        url += `&severity=${severityFilter}`;
      }
      if (categoryFilter) {
        url += `&categories=${categoryFilter}`;
      }

      const response = await axios.get(url, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });
      
      if (response.data.success) {
        const newNews = response.data.data;
        
        // Check for new items
        const newItems = newNews.filter(
          (item: BreakingNews) => !previousNewsIds.current.has(item.id)
        );
        
        if (newItems.length > 0 && news.length > 0) {
          setNewCount(newItems.length);
          if (soundEnabled) {
            playAlert();
          }
          // Show browser notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('🚨 Breaking News Alert!', {
              body: `${newItems.length} new breaking news item(s)`,
              icon: '/favicon.ico',
              tag: 'breaking-news'
            });
          }
        }
        
        // Update previous IDs
        previousNewsIds.current = new Set(newNews.map((item: BreakingNews) => item.id));
        
        setNews(newNews);
        setLastFetchTime(new Date());
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          t('breaking_news_error') ||
          'Failed to fetch breaking news',
      );
    } finally {
      setIsLoading(false);
    }
  }, [minImpact, severityFilter, categoryFilter, soundEnabled]);

  // Initial fetch
  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchNews();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchNews]);

  // Apply filters
  useEffect(() => {
    let filtered = [...news];
    
    if (severityFilter) {
      filtered = filtered.filter(item => item.market_impact_level === severityFilter);
    }
    
    if (categoryFilter) {
      filtered = filtered.filter(item => item.primary_category === categoryFilter);
    }
    
    setFilteredNews(filtered);
  }, [news, severityFilter, categoryFilter]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const playAlert = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => {
        // eslint-disable-next-line no-console
        console.error('Failed to play alert:', err);
      });
    }
  };

  const clearNewCount = () => {
    setNewCount(0);
  };

  const handleDismiss = (newsId: string) => {
    setNews(prev => prev.filter(item => item.id !== newsId));
    setFilteredNews(prev => prev.filter(item => item.id !== newsId));
  };

  const getSeverityConfig = (level: string) => {
    return SEVERITY_CONFIG[level as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.low;
  };

  const categories = Array.from(new Set(news.map(item => item.primary_category)));

  const severityCounts = useMemo(() => ({
    high: news.filter(n => n.market_impact_level === 'high').length,
    medium: news.filter(n => n.market_impact_level === 'medium').length,
    low: news.filter(n => n.market_impact_level === 'low').length,
  }), [news]);

  return (
    <div className="space-y-6">
      <audio ref={audioRef} src="/sounds/alert.mp3" preload="auto" />

      <Card className={DATAHUB_SHELL}>
        <DataHubSectionHeader
          title={t('telegram_data_tab_breaking') || 'Breaking News Monitor'}
          subtitle={t('breaking_news_desc') || 'Real-time high-impact Telegram events with severity filtering.'}
        />
        <DataHubToolbar className="mb-4">
          <DataHubFilterBar>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground">
                {t('min_impact') || 'Min Impact'}:
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={minImpact}
                onChange={(e) => setMinImpact(parseFloat(e.target.value))}
                className="w-32 accent-purple-500"
                aria-label={t('min_impact') || 'Minimum impact'}
              />
              <span className="text-[11px] font-medium">{(minImpact * 100).toFixed(0)}%</span>
            </div>
            <DataHubToggle
              id="breaking-sound"
              checked={soundEnabled}
              onChange={setSoundEnabled}
              label={soundEnabled ? (t('breaking_sound_on') || 'Sound On') : (t('breaking_sound_off') || 'Sound Off')}
            />
            <DataHubToggle
              id="breaking-auto-refresh"
              checked={autoRefresh}
              onChange={setAutoRefresh}
              label={autoRefresh ? (t('breaking_auto_refresh_on') || 'Auto-refresh On') : (t('breaking_auto_refresh_off') || 'Auto-refresh Off')}
            />
          </DataHubFilterBar>
          <PrimaryButton type="button" onClick={fetchNews} disabled={isLoading}>
            {isLoading ? t('loading') || 'Loading…' : `🔄 ${t('refresh') || 'Refresh'}`}
          </PrimaryButton>
        </DataHubToolbar>

        <DataHubFilterBar className="mb-3">
          <span className="text-[11px] text-muted-foreground">
            {t('breaking_severity') || 'Severity'}:
          </span>
          <DataHubSegmentedControl
            ariaLabel={t('breaking_severity') || 'Severity filter'}
            value={severityFilter ?? 'all'}
            onChange={v => setSeverityFilter(v === 'all' ? null : v)}
            options={[
              { value: 'all', label: t('all') || 'All' },
              ...Object.entries(SEVERITY_CONFIG).map(([key, config]) => ({
                value: key,
                label: `${config.icon} ${config.label}`,
              })),
            ]}
          />
          {categories.length > 0 && (
            <>
              <span className="text-[11px] text-muted-foreground">
                {t('category') || 'Category'}:
              </span>
              <select
                value={categoryFilter || ''}
                onChange={(e) => setCategoryFilter(e.target.value || null)}
                className="text-[11px] bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-1.5 text-foreground"
                aria-label={t('category') || 'Category filter'}
              >
                <option value="">{t('all_categories') || 'All Categories'}</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_ICONS[cat]} {cat}
                  </option>
                ))}
              </select>
            </>
          )}
        </DataHubFilterBar>

        <p className="text-[11px] text-muted-foreground">
          {t('last_updated') || 'Last updated'}:{' '}
          {formatDistanceToNow(lastFetchTime, { addSuffix: true })}
        </p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <MetricCard label={t('total') || 'Total'} value={news.length} color="blue" />
        <MetricCard label="Critical" value={severityCounts.high} color="red" />
        <MetricCard label="Warning" value={severityCounts.medium} color="amber" />
        <MetricCard label={t('filtered') || 'Filtered'} value={filteredNews.length} color="purple" />
      </div>

      {newCount > 0 && (
        <DataHubAlert
          variant="warning"
          message={
            t('breaking_new_items', { count: newCount }) ||
            `${newCount} new breaking news items`
          }
          onRetry={clearNewCount}
          retryLabel={t('acknowledge') || 'Acknowledge'}
        />
      )}

      {error && (
        <DataHubAlert variant="error" message={error} onRetry={fetchNews} retryLabel={t('retry')} />
      )}

      {isLoading && news.length === 0 && (
        <DataHubLoadingSpinner message={t('loading') || 'Loading breaking news…'} />
      )}

      {!isLoading && filteredNews.length === 0 && (
        <DataHubEmpty
          message={
            t('no_breaking_news_hint') ||
            'No high-impact news items found with the current filters.'
          }
        />
      )}

      <div className="space-y-4">
        {filteredNews.map((item) => {
          const severity = getSeverityConfig(item.market_impact_level);
          
          return (
            <Card
              key={item.id}
              className={`${DATAHUB_INNER_LIST} border-l-4 ${severity.border}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                  <div className="text-2xl md:text-3xl" aria-hidden>
                    {severity.icon}
                  </div>
                  <StatusPill
                    label={severity.label}
                    variant={severityVariant(item.market_impact_level)}
                  />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusPill
                        label={`${CATEGORY_ICONS[item.primary_category] || '📰'} ${item.primary_category}`}
                        variant="primary"
                      />
                      <StatusPill label={`📢 ${item.channel_title}`} variant="info" />
                      <StatusPill
                        label={item.sentiment}
                        variant={sentimentVariant(item.sentiment)}
                      />
                    </div>

                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      🕐 {formatDistanceToNow(new Date(item.telegram_created_at), { addSuffix: true })}
                    </span>
                  </div>

                  <p className="text-sm text-foreground leading-relaxed mb-3">
                    {item.cleaned_text}
                  </p>

                  {item.mentioned_assets && item.mentioned_assets.length > 0 && (
                    <div className="mb-3">
                      <span className="text-[11px] text-muted-foreground mr-2">
                        {t('assets') || 'Assets'}:
                      </span>
                      {item.mentioned_assets.map((asset, i) => (
                        <StatusPill key={asset + i} label={`💰 ${asset}`} variant="warning" className="mr-1" />
                      ))}
                    </div>
                  )}

                  {item.top_affected_agents && item.top_affected_agents.length > 0 && (
                    <div className="mb-3">
                      <span className="text-[11px] text-muted-foreground mb-1 block">
                        🤖 {t('affected_agents') || 'Affected Agents'} ({item.affected_agents_count}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {item.top_affected_agents.map((agent, i) => (
                          <StatusPill
                            key={agent.agent_key + i}
                            label={`${agent.agent_key} (${(parseFloat(agent.impact_score) * 100).toFixed(0)}%)${agent.requires_action ? ` ⚠️ ${t('action_required') || 'ACTION'}` : ''}`}
                            variant={agent.requires_action ? 'error' : 'info'}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                    {item.regions && item.regions.length > 0 && (
                      <span>🌍 {item.regions.join(', ')}</span>
                    )}
                    {item.source_reliability && (
                      <span>
                        ✓ {t('reliability') || 'Reliability'}:{' '}
                        {(parseFloat(item.source_reliability) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <PrimaryButton type="button" onClick={() => setSelectedNews(item)}>
                      📋 {t('view_details') || 'View Details'}
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={() => handleDismiss(item.id)}>
                      ✕ {t('dismiss') || 'Dismiss'}
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(item.cleaned_text);
                        }
                      }}
                    >
                      📋 {t('copy') || 'Copy'}
                    </SecondaryButton>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {selectedNews && (
        <DataHubModal
          title={selectedNews.channel_title || 'Unknown channel'}
          subtitle={`${t('breaking_news') || 'Breaking News'} – ${getSeverityConfig(selectedNews.market_impact_level).label} • ID ${selectedNews.message_id}`}
          onClose={() => setSelectedNews(null)}
          maxWidth="max-w-4xl"
          footer={
            <>
              <SecondaryButton type="button" onClick={() => setSelectedNews(null)}>
                {t('close') || 'Close'}
              </SecondaryButton>
              <SecondaryButton
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(selectedNews.cleaned_text);
                  }
                }}
              >
                📋 {t('copy') || 'Copy'}
              </SecondaryButton>
              <PrimaryButton
                type="button"
                onClick={() => {
                  handleDismiss(selectedNews.id);
                  setSelectedNews(null);
                }}
              >
                ✕ {t('dismiss') || 'Dismiss'}
              </PrimaryButton>
            </>
          }
        >
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <StatusPill
                  label={getSeverityConfig(selectedNews.market_impact_level).label}
                  variant={severityVariant(selectedNews.market_impact_level)}
                />
                <StatusPill
                  label={`${CATEGORY_ICONS[selectedNews.primary_category] || '📰'} ${selectedNews.primary_category}`}
                  variant="primary"
                />
                {selectedNews.sub_category && (
                  <StatusPill label={selectedNews.sub_category} variant="neutral" />
                )}
                <StatusPill
                  label={selectedNews.sentiment}
                  variant={sentimentVariant(selectedNews.sentiment)}
                />
                {selectedNews.importance_level && (
                  <StatusPill label={`Importance: ${selectedNews.importance_level}`} variant="warning" />
                )}
                {selectedNews.event_urgency && (
                  <StatusPill label={`Urgency: ${selectedNews.event_urgency}`} variant="warning" />
                )}
              </div>

              {/* Message text */}
              <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4">
                <p className="text-xs md:text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {selectedNews.cleaned_text}
                </p>
              </div>

              {/* Assets */}
              {selectedNews.mentioned_assets && selectedNews.mentioned_assets.length > 0 && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    {t('assets') || 'Mentioned Assets'}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedNews.mentioned_assets.map((asset, i) => (
                      <span
                        key={asset + i}
                        className="px-2 py-0.5 text-[11px] bg-yellow-500/20 text-yellow-300 rounded-full"
                      >
                        💰 {asset}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Affected Markets & Assets */}
              {(selectedNews.affected_markets?.length > 0 ||
                selectedNews.affected_assets?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedNews.affected_markets && selectedNews.affected_markets.length > 0 && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                      <p className="text-[11px] text-muted-foreground mb-2">
                        {t('affected_markets') || 'Affected Markets'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedNews.affected_markets.map((market, i) => (
                          <span
                            key={market + i}
                            className="px-2 py-0.5 text-[11px] bg-blue-500/20 text-blue-300 rounded-full"
                          >
                            {market}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedNews.affected_assets && selectedNews.affected_assets.length > 0 && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                      <p className="text-[11px] text-muted-foreground mb-2">
                        {t('affected_assets') || 'Affected Assets'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedNews.affected_assets.map((asset, i) => (
                          <span
                            key={asset + i}
                            className="px-2 py-0.5 text-[11px] bg-emerald-500/20 text-emerald-300 rounded-full"
                          >
                            {asset}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Affected Agents */}
              {selectedNews.top_affected_agents &&
                selectedNews.top_affected_agents.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      🤖 {t('affected_agents') || 'Affected Agents'} (
                      {selectedNews.affected_agents_count})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedNews.top_affected_agents.map((agent, i) => (
                        <span
                          key={agent.agent_key + i}
                          className={`px-2 py-1 text-[11px] rounded-full ${
                            agent.requires_action
                              ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {agent.agent_key} ({(parseFloat(agent.impact_score) * 100).toFixed(0)}%)
                          {agent.requires_action &&
                            ` ⚠️ ${t('action_required') || 'ACTION REQUIRED'}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Regions & Entities */}
              {(selectedNews.regions?.length > 0 || selectedNews.affected_entities?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedNews.regions && selectedNews.regions.length > 0 && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                      <p className="text-[11px] text-muted-foreground mb-1">
                        {t('regions') || 'Regions'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedNews.regions.map((region, i) => (
                          <span
                            key={region + i}
                            className="px-2 py-0.5 text-[11px] bg-indigo-500/20 text-indigo-300 rounded-full"
                          >
                            🌍 {region}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedNews.affected_entities && selectedNews.affected_entities.length > 0 && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                      <p className="text-[11px] text-muted-foreground mb-1">
                        {t('affected_entities') || 'Affected Entities'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedNews.affected_entities.map((entity, i) => (
                          <span
                            key={entity + i}
                            className="px-2 py-0.5 text-[11px] bg-purple-500/20 text-purple-300 rounded-full"
                          >
                            {entity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Meta info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <p className="mb-1 text-slate-300">{t('timestamps') || 'Timestamps'}</p>
                  <p>
                    Telegram:{' '}
                    {new Date(selectedNews.telegram_created_at).toLocaleString()}
                  </p>
                  <p>
                    Processed:{' '}
                    {selectedNews.created_at
                      ? new Date(selectedNews.created_at).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <p className="mb-1 text-slate-300">{t('ids') || 'IDs'}</p>
                  <p>
                    Message ID: <span className="font-mono">{selectedNews.message_id}</span>
                  </p>
                  <p>
                    Internal ID: <span className="font-mono">{selectedNews.id}</span>
                  </p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <p className="mb-1 text-slate-300">{t('source') || 'Source'}</p>
                  <p>{selectedNews.channel_title}</p>
                  {selectedNews.channel_username && (
                    <p className="font-mono text-slate-300">@{selectedNews.channel_username}</p>
                  )}
                  {selectedNews.source_reliability && (
                    <p className="text-emerald-300 mt-1">
                      ✓ {t('reliability') || 'Reliability'}:{' '}
                      {(parseFloat(selectedNews.source_reliability) * 100).toFixed(0)}%
                    </p>
                  )}
                </div>
              </div>

        </DataHubModal>
      )}
    </div>
  );
};

export default BreakingNewsMonitor;


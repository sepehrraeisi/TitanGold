import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';

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
    color: 'red',
    icon: '🚨',
    label: 'CRITICAL'
  },
  medium: {
    color: 'yellow',
    icon: '⚠️',
    label: 'WARNING'
  },
  low: {
    color: 'green',
    icon: 'ℹ️',
    label: 'INFO'
  }
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

  // Get unique categories from news
  const categories = Array.from(new Set(news.map(item => item.primary_category)));

  return (
    <div className="space-y-6">
      {/* Audio Alert */}
      <audio ref={audioRef} src="/sounds/alert.mp3" preload="auto" />

      {/* Controls */}
      <Card className="bg-slate-950/70 border border-white/5 shadow-lg">
        <div className="space-y-4">
          {/* Breaking News Monitor - Updated Design */}
          {/* Top Controls */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Impact Slider */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {t('min_impact') || 'Min Impact'}:
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={minImpact}
                onChange={(e) => setMinImpact(parseFloat(e.target.value))}
                className="w-32"
              />
              <span className="text-sm font-medium">{(minImpact * 100).toFixed(0)}%</span>
            </div>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-1 text-xs md:text-sm rounded-full border transition-colors ${
                soundEnabled
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-950/60 border-slate-700 text-muted-foreground hover:bg-slate-900'
              }`}
            >
              {soundEnabled
                ? t('breaking_sound_on') || '🔔 Sound On'
                : t('breaking_sound_off') || '🔕 Sound Off'}
            </button>

            {/* Auto-refresh Toggle */}
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1 text-xs md:text-sm rounded-full border transition-colors ${
                autoRefresh
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-slate-950/60 border-slate-700 text-muted-foreground hover:bg-slate-900'
              }`}
            >
              {autoRefresh
                ? t('breaking_auto_refresh_on') || '🔄 Auto-refresh On'
                : t('breaking_auto_refresh_off') || '⏸️ Auto-refresh Off'}
            </button>

            {/* Manual Refresh */}
            <button
              type="button"
              onClick={fetchNews}
              disabled={isLoading}
              className="inline-flex items-center justify-center px-4 py-1.5 text-xs md:text-sm rounded-full font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white shadow-sm transition-colors"
            >
              {isLoading ? t('loading') || '⏳ Loading...' : `🔄 ${t('refresh') || 'Refresh'}`}
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Severity Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t('breaking_severity') || 'Severity'}:
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSeverityFilter(null)}
                  className={`px-2 py-1 text-xs rounded-full border ${
                    !severityFilter
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-slate-950/60 border-slate-700 text-muted-foreground hover:bg-slate-900'
                  }`}
                >
                  {t('all') || 'All'}
                </button>
                {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSeverityFilter(key)}
                    className={`px-2 py-1 text-xs rounded-full border ${
                      severityFilter === key
                        ? `bg-${config.color}-500 border-${config.color}-400 text-white`
                        : 'bg-slate-950/60 border-slate-700 text-muted-foreground hover:bg-slate-900'
                    }`}
                  >
                    {config.icon} {config.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {t('category') || 'Category'}:
                </span>
                <select
                  value={categoryFilter || ''}
                  onChange={(e) => setCategoryFilter(e.target.value || null)}
                  className="px-2 py-1 text-xs md:text-sm bg-slate-950/60 border border-slate-700 rounded-full text-foreground"
                >
                  <option value="">{t('all_categories') || 'All Categories'}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_ICONS[cat]} {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Last Update */}
          <div className="text-xs text-muted-foreground">
            {t('last_updated') || 'Last updated'}:{' '}
            {formatDistanceToNow(lastFetchTime, { addSuffix: true })}
          </div>
        </div>
      </Card>

      {/* New Items Banner */}
      {newCount > 0 && (
        <div className="bg-red-500/15 border border-red-500/60 rounded-xl p-3 md:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-red-300 text-xs md:text-sm font-semibold">
              🚨{' '}
              {t('breaking_new_items', { count: newCount }) ||
                `${newCount} new breaking news items`}
            </p>
            <button
              type="button"
              onClick={clearNewCount}
              className="px-3 py-1 text-xs md:text-sm rounded-full bg-red-600 hover:bg-red-500 text-white"
            >
              {t('acknowledge') || 'Acknowledge'}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm font-medium text-red-200 mb-1">
            {t('breaking_news_error_title') || 'Breaking news error'}
          </p>
          <p className="text-[11px] text-red-300">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredNews.length === 0 && (
        <Card className="bg-slate-950/80 border border-white/5">
          <div className="text-center py-10">
            <div className="text-5xl mb-3">📰</div>
            <p className="text-sm md:text-base font-semibold mb-1 text-foreground">
              {t('no_breaking_news') || 'No Breaking News'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t('no_breaking_news_hint') ||
                'No high-impact news items found with the current filters.'}
            </p>
          </div>
        </Card>
      )}

      {/* News Feed */}
      <div className="space-y-4">
        {filteredNews.map((item) => {
          const severity = getSeverityConfig(item.market_impact_level);
          
          return (
            <Card
              key={item.id}
              className={`bg-slate-950/80 border border-white/5 rounded-xl shadow-sm border-l-4 border-${severity.color}-500`}
            >
              <div className="flex items-start gap-4">
                {/* Severity Indicator */}
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                  <div className="text-2xl md:text-3xl">
                    {severity.icon}
                  </div>
                  <span className={`text-xs font-bold text-${severity.color}-400`}>
                    {severity.label}
                  </span>
                </div>

                {/* Content */}
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Category Badge */}
                      <span className="px-2 py-1 text-[11px] bg-purple-500/20 text-purple-300 rounded-full flex items-center gap-1">
                        {CATEGORY_ICONS[item.primary_category] || '📰'}
                        {item.primary_category}
                      </span>
                      
                      {/* Source */}
                      <span className="px-2 py-1 text-[11px] bg-blue-500/20 text-blue-300 rounded-full">
                        📢 {item.channel_title}
                      </span>
                      
                      {/* Sentiment */}
                      <span
                        className={`px-2 py-1 text-[11px] rounded-full ${
                        item.sentiment === 'positive' ? 'bg-green-500/20 text-green-300' :
                        item.sentiment === 'negative' ? 'bg-red-500/20 text-red-300' :
                        'bg-gray-500/20 text-gray-300'
                        }`}
                      >
                        {item.sentiment === 'positive' ? '😊' : item.sentiment === 'negative' ? '😟' : '😐'} {item.sentiment}
                      </span>
                    </div>

                    {/* Timestamp */}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      🕐 {formatDistanceToNow(new Date(item.telegram_created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* News Text */}
                  <p className="text-sm text-foreground leading-relaxed mb-3">
                    {item.cleaned_text}
                  </p>

                  {/* Assets */}
                  {item.mentioned_assets && item.mentioned_assets.length > 0 && (
                    <div className="mb-3">
                      <span className="text-[11px] text-muted-foreground mr-2">
                        {t('assets') || 'Assets'}:
                      </span>
                      {item.mentioned_assets.map((asset, i) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <span
                          key={i}
                          className="px-2 py-0.5 text-[11px] bg-yellow-500/20 text-yellow-300 rounded-full mr-1"
                        >
                          💰 {asset}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Affected Agents */}
                  {item.top_affected_agents && item.top_affected_agents.length > 0 && (
                    <div className="mb-3">
                      <span className="text-[11px] text-muted-foreground mb-1 block">
                        🤖 {t('affected_agents') || 'Affected Agents'} ({item.affected_agents_count}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {item.top_affected_agents.map((agent, i) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <span
                            key={i}
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

                  {/* Metadata */}
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

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="px-3 py-1 text-xs md:text-sm rounded-full bg-purple-600 hover:bg-purple-500 text-white font-medium shadow-sm transition-colors"
                      onClick={() => setSelectedNews(item)}
                      >
                      📋 {t('view_details') || 'View Details'}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 text-xs md:text-sm rounded-full bg-slate-950/60 hover:bg-slate-900 border border-slate-700 text-muted-foreground transition-colors"
                      onClick={() => handleDismiss(item.id)}
                      >
                      ✕ {t('dismiss') || 'Dismiss'}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 text-xs md:text-sm rounded-full bg-slate-950/60 hover:bg-slate-900 border border-slate-700 text-muted-foreground transition-colors"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(item.cleaned_text);
                        }
                      }}
                      >
                      📋 {t('copy') || 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* View Details Modal */}
      {selectedNews && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedNews(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-950/90 to-slate-900/95 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-3 border-b border-white/10">
              <div className="flex items-start gap-3">
                <div className="text-3xl md:text-4xl">
                  {getSeverityConfig(selectedNews.market_impact_level).icon}
                </div>
                <div>
                  <p className="text-[11px] text-purple-300/80 mb-0.5">
                    {t('breaking_news') || 'Breaking News'} –{' '}
                    {getSeverityConfig(selectedNews.market_impact_level).label}
                  </p>
                  <h3 className="text-sm md:text-base font-semibold text-foreground">
                    {selectedNews.channel_title || 'Unknown channel'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    ID: <span className="font-mono">{selectedNews.message_id}</span> •{' '}
                    {formatDistanceToNow(new Date(selectedNews.telegram_created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNews(null)}
                className="text-slate-400 hover:text-slate-100 text-lg"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2 py-1 text-[11px] rounded-full text-white ${
                    selectedNews.market_impact_level === 'high'
                      ? 'bg-red-500'
                      : selectedNews.market_impact_level === 'medium'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  }`}
                >
                  {getSeverityConfig(selectedNews.market_impact_level).label}
                </span>
                <span className="px-2 py-1 text-[11px] rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/50">
                  {CATEGORY_ICONS[selectedNews.primary_category] || '📰'}{' '}
                  {selectedNews.primary_category}
                </span>
                {selectedNews.sub_category && (
                  <span className="px-2 py-1 text-[11px] rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                    {selectedNews.sub_category}
                  </span>
                )}
                <span
                  className={`px-2 py-1 text-[11px] rounded-full ${
                    selectedNews.sentiment === 'positive'
                      ? 'bg-green-500/20 text-green-300'
                      : selectedNews.sentiment === 'negative'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-gray-500/20 text-gray-300'
                  }`}
                >
                  {selectedNews.sentiment === 'positive'
                    ? '😊'
                    : selectedNews.sentiment === 'negative'
                      ? '😟'
                      : '😐'}{' '}
                  {selectedNews.sentiment}
                </span>
                {selectedNews.importance_level && (
                  <span className="px-2 py-1 text-[11px] rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/50">
                    Importance: {selectedNews.importance_level}
                  </span>
                )}
                {selectedNews.event_urgency && (
                  <span className="px-2 py-1 text-[11px] rounded-full bg-orange-500/20 text-orange-200 border border-orange-500/50">
                    Urgency: {selectedNews.event_urgency}
                  </span>
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
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedNews(null)}
                className="px-3 py-1.5 text-xs md:text-sm rounded-full bg-slate-700 hover:bg-slate-600 text-white"
              >
                {t('close') || 'Close'}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(selectedNews.cleaned_text);
                    }
                  }}
                  className="px-3 py-1.5 text-xs md:text-sm rounded-full bg-slate-700 hover:bg-slate-600 text-white"
                >
                  📋 {t('copy') || 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDismiss(selectedNews.id);
                    setSelectedNews(null);
                  }}
                  className="px-3 py-1.5 text-xs md:text-sm rounded-full bg-red-600 hover:bg-red-500 text-white font-medium"
                >
                  ✕ {t('dismiss') || 'Dismiss'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BreakingNewsMonitor;


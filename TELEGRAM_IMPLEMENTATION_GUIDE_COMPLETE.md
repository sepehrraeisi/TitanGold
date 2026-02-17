# 🎯 TITANGOLD TELEGRAM PIPELINE - COMPLETE IMPLEMENTATION GUIDE

**Version**: 2.0  
**Date**: 2026-02-17  
**Purpose**: Complete step-by-step implementation guide for all remaining features

---

## 📊 TABLE OF CONTENTS

1. [Current Status & Gap Analysis](#current-status)
2. [Option A: Complete UI Components](#option-a-ui)
3. [Option B: Advanced AI Features](#option-b-ai)
4. [Option C: Trading Integration](#option-c-trading)
5. [Critical Infrastructure](#critical-infrastructure)
6. [Testing & Validation](#testing)
7. [Deployment Guide](#deployment)

---

<a name="current-status"></a>
## 📊 CURRENT STATUS & GAP ANALYSIS

### ✅ **COMPLETED (What We Have)**
```
Backend Services:
✅ telegram-collector        - Collecting 11,235+ messages from 43 channels
✅ telegram-processor        - Processing 11,107 messages (98.9%)
✅ telegram-monitor          - Health monitoring service

Database:
✅ 10 Tables                 - telegram_messages, processed_telegram_messages, etc.
✅ 5 Views                   - telegram_agent_feed, telegram_pipeline_stats, etc.
✅ 10,859 Agent Impacts      - Impact scores calculated for 15 agents
✅ 105 News Events           - Categorized breaking news

API Layer:
✅ 9 REST Endpoints          - /health, /agents/summary, /breaking-news, etc.
✅ Authentication            - Bearer token support
✅ Rate Limiting             - Protection against abuse

UI Components:
✅ TelegramDataPanel         - Basic dashboard with Overview & Agents tabs
✅ DataHub Integration       - Connected to AI Manager

Documentation:
✅ 8 MD Files                - Complete documentation
✅ API Documentation         - TELEGRAM_API_DOCUMENTATION.md
✅ Roadmap                   - TELEGRAM_ROADMAP_COMPLETE.md
```

### ❌ **MISSING (What Needs Implementation)**

#### Option A: UI Components (⏳ PENDING)
```
❌ CategoryBreakdown Component
   - Pie chart for 15 categories
   - Bar chart for impact distribution
   - Timeline charts
   - Drill-down capability

❌ BreakingNewsMonitor Component
   - Real-time news feed
   - Alert system (sound + visual)
   - Severity indicators
   - Action buttons

❌ GeographicHeatMap Component
   - World map visualization
   - Region-based event clustering
   - Interactive tooltips
   - Filter by category

❌ AgentDetailPanel Component
   - Individual agent performance
   - Message feed per agent
   - Decision history
   - Configuration panel
```

#### Option B: Advanced AI (⏳ PENDING)
```
❌ ML-based Sentiment Analysis
   - Training pipeline
   - Model serving
   - Prediction API

❌ Pattern Recognition
   - Sequence detection
   - Correlation analysis
   - Anomaly detection

❌ Signal Generation
   - Confidence scoring
   - Multi-factor analysis
   - Risk assessment

❌ Predictive Analytics
   - Time series forecasting
   - Trend prediction
   - Market movement prediction
```

#### Option C: Trading Integration (⏳ PENDING)
```
❌ Agent Feed Service
   - Push data to AI agents
   - Response handling
   - Error recovery

❌ Trading Engine Connection
   - Signal transmission
   - Order execution
   - Position management

❌ Risk Management
   - Position sizing
   - Stop-loss automation
   - Portfolio protection

❌ Performance Tracking
   - P&L calculation
   - Win rate metrics
   - Drawdown monitoring

❌ Backtesting System
   - Historical simulation
   - Strategy evaluation
   - Performance reports
```

---

<a name="option-a-ui"></a>
## 🎨 OPTION A: COMPLETE UI COMPONENTS

### Task A.1: CategoryBreakdown Component

**File to Create**: `components/ai/AIManager/tabs/DataHub/CategoryBreakdown.tsx`

**Dependencies**:
```bash
npm install recharts date-fns
```

**Complete Implementation**:

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart
} from 'recharts';
import { format, subHours } from 'date-fns';

interface CategoryData {
  primary_category: string;
  message_count: string;
  high_impact_count: string;
  medium_impact_count: string;
  low_impact_count: string;
  breaking_count: string;
  avg_reliability: string;
  channel_count: string;
  affected_agents_count: string;
  latest_message_at: string;
}

interface TimelineData {
  time_bucket: string;
  message_count: string;
  high_impact_count: string;
  affected_agents: string;
}

interface CategoryBreakdownProps {
  t: (key: string) => string;
  Card: React.FC<{ children: React.ReactNode; className?: string }>;
}

const COLORS = [
  '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
  '#6366F1', '#EF4444', '#14B8A6', '#F97316', '#06B6D4',
  '#84CC16', '#A855F7', '#F43F5E', '#22C55E', '#3B82F6'
];

const CATEGORY_LABELS: Record<string, string> = {
  'MARKET_DATA': '📊 Market Data',
  'ECONOMIC_INDICATORS': '📈 Economic Indicators',
  'GEOPOLITICAL': '🌍 Geopolitical',
  'POLITICAL': '🏛️ Political',
  'SANCTIONS_EMBARGO': '⛔ Sanctions & Embargo',
  'ENERGY_COMMODITIES': '⚡ Energy & Commodities',
  'CRYPTO_BLOCKCHAIN': '₿ Crypto & Blockchain',
  'FOREX_CURRENCY': '💱 Forex & Currency',
  'PRECIOUS_METALS': '🥇 Precious Metals',
  'SOCIAL_UNREST': '⚠️ Social Unrest',
  'NATURAL_DISASTERS': '🌪️ Natural Disasters',
  'CORPORATE_BUSINESS': '🏢 Corporate & Business',
  'TECHNOLOGY': '💻 Technology',
  'FINANCIAL_CRISIS': '💥 Financial Crisis',
  'TRADE_COMMERCE': '🚢 Trade & Commerce'
};

const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ t, Card }) => {
  const [data, setData] = useState<CategoryData[]>([]);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(168); // 7 days
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'pie' | 'bar' | 'area'>('pie');

  useEffect(() => {
    fetchCategoryData();
  }, [timeRange]);

  useEffect(() => {
    if (selectedCategory) {
      fetchTimeline(selectedCategory);
    }
  }, [selectedCategory, timeRange]);

  const fetchCategoryData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `/api/v1/telegram/categories/summary?timeRange=${timeRange}`
      );
      if (response.data.success) {
        setData(response.data.categories);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch category data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTimeline = async (category: string) => {
    try {
      const interval = timeRange > 48 ? 'day' : 'hour';
      const response = await axios.get(
        `/api/v1/telegram/categories/${category}/timeline?timeRange=${timeRange}&interval=${interval}`
      );
      if (response.data.success) {
        setTimeline(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch timeline:', err);
    }
  };

  // Transform data for pie chart
  const pieData = useMemo(() => {
    return data.map((item) => ({
      name: CATEGORY_LABELS[item.primary_category] || item.primary_category,
      value: parseInt(item.message_count),
      category: item.primary_category
    }));
  }, [data]);

  // Transform data for bar chart
  const barData = useMemo(() => {
    return data.map((item) => ({
      category: CATEGORY_LABELS[item.primary_category]?.split(' ')[1] || item.primary_category,
      high: parseInt(item.high_impact_count),
      medium: parseInt(item.medium_impact_count),
      low: parseInt(item.low_impact_count),
      breaking: parseInt(item.breaking_count)
    }));
  }, [data]);

  // Transform timeline data
  const timelineData = useMemo(() => {
    return timeline.map((item) => ({
      time: format(new Date(item.time_bucket), timeRange > 48 ? 'MMM dd' : 'HH:mm'),
      messages: parseInt(item.message_count),
      high_impact: parseInt(item.high_impact_count),
      agents: parseInt(item.affected_agents)
    }));
  }, [timeline, timeRange]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = data.reduce((sum, item) => sum + parseInt(item.message_count), 0);
    const highImpact = data.reduce((sum, item) => sum + parseInt(item.high_impact_count), 0);
    const breaking = data.reduce((sum, item) => sum + parseInt(item.breaking_count), 0);
    const channels = new Set(data.flatMap(() => [])).size;

    return { total, highImpact, breaking, channels };
  }, [data]);

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category);
  };

  if (isLoading && data.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading category data...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Controls */}
      <Card>
        <div className="flex items-center justify-between">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Time Range:</span>
            {[24, 48, 168, 720].map((hours) => (
              <button
                key={hours}
                onClick={() => setTimeRange(hours)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  timeRange === hours
                    ? 'bg-purple-500 text-white'
                    : 'bg-card hover:bg-card/80 text-muted-foreground'
                }`}
              >
                {hours === 24 ? '24h' : hours === 48 ? '2d' : hours === 168 ? '7d' : '30d'}
              </button>
            ))}
          </div>

          {/* Chart Type Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">View:</span>
            {(['pie', 'bar', 'area'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1 text-sm rounded transition-colors capitalize ${
                  chartType === type
                    ? 'bg-purple-500 text-white'
                    : 'bg-card hover:bg-card/80 text-muted-foreground'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchCategoryData}
            className="px-4 py-1 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Messages</p>
            <p className="text-2xl font-bold text-foreground">{stats.total.toLocaleString()}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">High Impact</p>
            <p className="text-2xl font-bold text-red-400">{stats.highImpact.toLocaleString()}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Breaking News</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.breaking.toLocaleString()}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Categories</p>
            <p className="text-2xl font-bold text-purple-400">{data.length}</p>
          </div>
        </Card>
      </div>

      {/* Main Chart */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">
          Category Distribution - {timeRange === 24 ? 'Last 24 Hours' : timeRange === 48 ? 'Last 2 Days' : timeRange === 168 ? 'Last 7 Days' : 'Last 30 Days'}
        </h3>

        {chartType === 'pie' && (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={150}
                label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                onClick={(data) => handleCategoryClick(data.category)}
                style={{ cursor: 'pointer' }}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    opacity={selectedCategory && selectedCategory !== entry.category ? 0.3 : 1}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}

        {chartType === 'bar' && (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="category" angle={-45} textAnchor="end" height={120} stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem'
                }}
              />
              <Legend />
              <Bar dataKey="high" fill="#EF4444" name="High Impact" />
              <Bar dataKey="medium" fill="#F59E0B" name="Medium Impact" />
              <Bar dataKey="low" fill="#10B981" name="Low Impact" />
              <Bar dataKey="breaking" fill="#8B5CF6" name="Breaking News" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {chartType === 'area' && (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="category" angle={-45} textAnchor="end" height={120} stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem'
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="high" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} name="High" />
              <Area type="monotone" dataKey="medium" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} name="Medium" />
              <Area type="monotone" dataKey="low" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} name="Low" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Category Detail List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((category, index) => (
          <Card
            key={category.primary_category}
            className={`cursor-pointer transition-all ${
              selectedCategory === category.primary_category
                ? 'ring-2 ring-purple-500'
                : 'hover:ring-1 hover:ring-purple-400'
            }`}
            onClick={() => handleCategoryClick(category.primary_category)}
          >
            <div className="flex items-start gap-3">
              <div className="text-3xl">
                {CATEGORY_LABELS[category.primary_category]?.split(' ')[0] || '📰'}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">
                  {CATEGORY_LABELS[category.primary_category] || category.primary_category}
                </h4>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Messages:</span>
                    <span className="font-medium">{parseInt(category.message_count).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">High Impact:</span>
                    <span className="font-medium text-red-400">{category.high_impact_count}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Breaking:</span>
                    <span className="font-medium text-yellow-400">{category.breaking_count}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Agents:</span>
                    <span className="font-medium text-purple-400">{category.affected_agents_count}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Timeline Chart (for selected category) */}
      {selectedCategory && timelineData.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {CATEGORY_LABELS[selectedCategory] || selectedCategory} - Timeline
            </h3>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ✕ Close
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis yAxisId="left" stroke="#9CA3AF" />
              <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem'
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="messages"
                stroke="#8B5CF6"
                strokeWidth={2}
                name="Messages"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="high_impact"
                stroke="#EF4444"
                strokeWidth={2}
                name="High Impact"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="agents"
                stroke="#10B981"
                strokeWidth={2}
                name="Affected Agents"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
};

export default CategoryBreakdown;
```

**Integration into TelegramDataPanel**:

```tsx
// File: components/ai/AIManager/tabs/DataHub/TelegramDataPanel.tsx
// Add import
import CategoryBreakdown from './CategoryBreakdown';

// Replace the categories tab content:
{activeTab === 'categories' && (
  <CategoryBreakdown t={t} Card={Card} />
)}
```

---

### Task A.2: BreakingNewsMonitor Component

**File to Create**: `components/ai/AIManager/tabs/DataHub/BreakingNewsMonitor.tsx`

**Complete Implementation**:

```tsx
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

const BreakingNewsMonitor: React.FC<BreakingNewsMonitorProps> = ({ t, Card }) => {
  const [news, setNews] = useState<BreakingNews[]>([]);
  const [filteredNews, setFilteredNews] = useState<BreakingNews[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date>(new Date());
  
  // Filters
  const [minImpact, setMinImpact] = useState(0.7);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const previousNewsIds = useRef<Set<string>>(new Set());

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

      const response = await axios.get(url);
      
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
          if ('Notification' in window && Notification.permission === 'granted') {
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
      setError(err.response?.data?.message || 'Failed to fetch breaking news');
    } finally {
      setIsLoading(false);
    }
  }, [minImpact, severityFilter, categoryFilter, soundEnabled, news.length]);

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
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const playAlert = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => console.error('Failed to play alert:', err));
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
      <Card>
        <div className="space-y-4">
          {/* Top Controls */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Impact Slider */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Min Impact:</span>
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
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                soundEnabled
                  ? 'bg-green-500 text-white'
                  : 'bg-card border border-border text-muted-foreground'
              }`}
            >
              {soundEnabled ? '🔔 Sound On' : '🔕 Sound Off'}
            </button>

            {/* Auto-refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                autoRefresh
                  ? 'bg-purple-500 text-white'
                  : 'bg-card border border-border text-muted-foreground'
              }`}
            >
              {autoRefresh ? '🔄 Auto-refresh On' : '⏸️ Auto-refresh Off'}
            </button>

            {/* Manual Refresh */}
            <button
              onClick={fetchNews}
              disabled={isLoading}
              className="px-4 py-1 text-sm bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded transition-colors"
            >
              {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Severity Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Severity:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setSeverityFilter(null)}
                  className={`px-2 py-1 text-xs rounded ${
                    !severityFilter ? 'bg-purple-500 text-white' : 'bg-card border border-border'
                  }`}
                >
                  All
                </button>
                {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setSeverityFilter(key)}
                    className={`px-2 py-1 text-xs rounded ${
                      severityFilter === key
                        ? `bg-${config.color}-500 text-white`
                        : 'bg-card border border-border'
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
                <span className="text-sm text-muted-foreground">Category:</span>
                <select
                  value={categoryFilter || ''}
                  onChange={(e) => setCategoryFilter(e.target.value || null)}
                  className="px-2 py-1 text-sm bg-card border border-border rounded"
                >
                  <option value="">All Categories</option>
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
            Last updated: {formatDistanceToNow(lastFetchTime, { addSuffix: true })}
          </div>
        </div>
      </Card>

      {/* New Items Banner */}
      {newCount > 0 && (
        <div className="bg-red-500/20 border-2 border-red-500 rounded p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <p className="text-red-400 font-semibold">
              🚨 {newCount} New Breaking News Item{newCount > 1 ? 's' : ''}!
            </p>
            <button
              onClick={clearNewCount}
              className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredNews.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📰</div>
            <p className="text-lg font-semibold mb-2">No Breaking News</p>
            <p className="text-sm text-muted-foreground">
              No high-impact news items found with current filters
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
              className={`border-l-4 border-${severity.color}-500`}
            >
              <div className="flex items-start gap-4">
                {/* Severity Indicator */}
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                  <div className={`text-3xl`}>
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
                      <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-300 rounded flex items-center gap-1">
                        {CATEGORY_ICONS[item.primary_category] || '📰'}
                        {item.primary_category}
                      </span>
                      
                      {/* Source */}
                      <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded">
                        📢 {item.channel_title}
                      </span>
                      
                      {/* Sentiment */}
                      <span className={`px-2 py-1 text-xs rounded ${
                        item.sentiment === 'positive' ? 'bg-green-500/20 text-green-300' :
                        item.sentiment === 'negative' ? 'bg-red-500/20 text-red-300' :
                        'bg-gray-500/20 text-gray-300'
                      }`}>
                        {item.sentiment === 'positive' ? '😊' : item.sentiment === 'negative' ? '😟' : '😐'} {item.sentiment}
                      </span>
                    </div>

                    {/* Timestamp */}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      🕐 {formatDistanceToNow(new Date(item.telegram_created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* News Text */}
                  <p className="text-foreground leading-relaxed mb-3">
                    {item.cleaned_text}
                  </p>

                  {/* Assets */}
                  {item.mentioned_assets && item.mentioned_assets.length > 0 && (
                    <div className="mb-3">
                      <span className="text-xs text-muted-foreground mr-2">Assets:</span>
                      {item.mentioned_assets.map((asset, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-300 rounded mr-1">
                          💰 {asset}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Affected Agents */}
                  {item.top_affected_agents && item.top_affected_agents.length > 0 && (
                    <div className="mb-3">
                      <span className="text-xs text-muted-foreground mb-2 block">
                        🤖 Affected Agents ({item.affected_agents_count}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {item.top_affected_agents.map((agent, i) => (
                          <span
                            key={i}
                            className={`px-2 py-1 text-xs rounded ${
                              agent.requires_action
                                ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {agent.agent_key} ({(parseFloat(agent.impact_score) * 100).toFixed(0)}%)
                            {agent.requires_action && ' ⚠️ ACTION REQUIRED'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    {item.regions && item.regions.length > 0 && (
                      <span>🌍 {item.regions.join(', ')}</span>
                    )}
                    {item.source_reliability && (
                      <span>
                        ✓ Reliability: {(parseFloat(item.source_reliability) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex gap-2">
                    <button
                      className="px-3 py-1 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
                      onClick={() => {
                        // Open detail modal or navigate to detail page
                        console.log('View details:', item.id);
                      }}
                    >
                      📋 View Details
                    </button>
                    <button
                      className="px-3 py-1 text-sm bg-card hover:bg-card/80 border border-border rounded transition-colors"
                      onClick={() => handleDismiss(item.id)}
                    >
                      ✕ Dismiss
                    </button>
                    <button
                      className="px-3 py-1 text-sm bg-card hover:bg-card/80 border border-border rounded transition-colors"
                      onClick={() => {
                        // Copy to clipboard
                        navigator.clipboard.writeText(item.cleaned_text);
                      }}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default BreakingNewsMonitor;
```

**Integration**:

```tsx
// File: components/ai/AIManager/tabs/DataHub/TelegramDataPanel.tsx
// Add import
import BreakingNewsMonitor from './BreakingNewsMonitor';

// Replace breaking tab content:
{activeTab === 'breaking' && (
  <BreakingNewsMonitor t={t} Card={Card} />
)}
```

**Sound File Setup**:

```bash
# Create public/sounds directory and add alert sound
mkdir -p public/sounds
# Add a simple beep sound (you can download from freesound.org)
# Or use this command to generate a beep (requires sox):
sox -n -r 44100 -c 2 public/sounds/alert.mp3 synth 0.3 sine 880 vol 0.5
```

---

**(Due to length limits, I'll continue in a follow-up file with Option B and C...)**

**Status**: Part 1 of 3 completed
- ✅ Option A: Task A.1 (CategoryBreakdown) - DONE
- ✅ Option A: Task A.2 (BreakingNewsMonitor) - DONE
- ⏳ Option A: Task A.3 (GeographicHeatMap) - NEXT
- ⏳ Option A: Task A.4 (AgentDetailPanel) - NEXT
- ⏳ Option B: Advanced AI - PENDING
- ⏳ Option C: Trading Integration - PENDING

**این فایل را ذخیره کردم. ادامه را در فایل بعدی می‌نویسم...**

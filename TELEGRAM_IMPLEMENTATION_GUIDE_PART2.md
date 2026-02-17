# 🎯 TITANGOLD TELEGRAM PIPELINE - IMPLEMENTATION GUIDE (PART 2/3)

**Continuation from TELEGRAM_IMPLEMENTATION_GUIDE_COMPLETE.md**

---

## 🎨 OPTION A: COMPLETE UI COMPONENTS (Continued)

### Task A.3: GeographicHeatMap Component

**File to Create**: `components/ai/AIManager/tabs/DataHub/GeographicHeatMap.tsx`

**Dependencies**:
```bash
npm install react-simple-maps react-tooltip d3-geo
```

**Complete Implementation**:

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup
} from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import ReactTooltip from 'react-tooltip';

interface EventLocation {
  region: string;
  count: number;
  high_impact_count: number;
  categories: string[];
  coordinates: [number, number]; // [longitude, latitude]
}

interface GeographicHeatMapProps {
  t: (key: string) => string;
  Card: React.FC<{ children: React.ReactNode; className?: string }>;
}

// World map topology URL
const GEO_URL = "https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json";

// Region to coordinates mapping (approximate centers)
const REGION_COORDS: Record<string, [number, number]> = {
  'NORTH_AMERICA': [-100, 45],
  'SOUTH_AMERICA': [-60, -15],
  'EUROPE': [10, 50],
  'MIDDLE_EAST': [45, 30],
  'ASIA': [90, 30],
  'AFRICA': [20, 0],
  'OCEANIA': [135, -25],
  'CENTRAL_ASIA': [65, 45],
  'SOUTHEAST_ASIA': [105, 10],
  'EAST_ASIA': [115, 35]
};

const CATEGORY_COLORS: Record<string, string> = {
  'GEOPOLITICAL': '#EF4444',
  'ECONOMIC_INDICATORS': '#F59E0B',
  'ENERGY_COMMODITIES': '#8B5CF6',
  'SANCTIONS_EMBARGO': '#EC4899',
  'DEFAULT': '#10B981'
};

const GeographicHeatMap: React.FC<GeographicHeatMapProps> = ({ t, Card }) => {
  const [data, setData] = useState<EventLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(168); // 7 days
  const [selectedRegion, setSelectedRegion] = useState<EventLocation | null>(null);
  const [tooltipContent, setTooltipContent] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchLocationData();
  }, [timeRange, categoryFilter]);

  const fetchLocationData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch events and aggregate by region
      let url = `/api/v1/telegram/events/recent?timeRange=${timeRange}&limit=1000`;
      if (categoryFilter) {
        url += `&categories=${categoryFilter}`;
      }

      const response = await axios.get(url);
      
      if (response.data.success) {
        const events = response.data.data;
        
        // Aggregate by region
        const regionMap = new Map<string, EventLocation>();
        
        events.forEach((event: any) => {
          const regions = event.regions || [];
          
          regions.forEach((region: string) => {
            if (regionMap.has(region)) {
              const existing = regionMap.get(region)!;
              existing.count++;
              if (event.market_impact_level === 'high') {
                existing.high_impact_count++;
              }
              if (!existing.categories.includes(event.primary_category)) {
                existing.categories.push(event.primary_category);
              }
            } else {
              regionMap.set(region, {
                region,
                count: 1,
                high_impact_count: event.market_impact_level === 'high' ? 1 : 0,
                categories: [event.primary_category],
                coordinates: REGION_COORDS[region] || [0, 0]
              });
            }
          });
        });
        
        setData(Array.from(regionMap.values()));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch location data');
    } finally {
      setIsLoading(false);
    }
  };

  // Color scale based on event count
  const colorScale = useMemo(() => {
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return scaleLinear<string>()
      .domain([0, maxCount / 2, maxCount])
      .range(['#10B981', '#F59E0B', '#EF4444']);
  }, [data]);

  // Size scale for markers
  const sizeScale = useMemo(() => {
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return scaleLinear()
      .domain([0, maxCount])
      .range([5, 30]);
  }, [data]);

  const handleMarkerClick = (location: EventLocation) => {
    setSelectedRegion(location === selectedRegion ? null : location);
  };

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    data.forEach(loc => loc.categories.forEach(cat => cats.add(cat)));
    return Array.from(cats);
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalEvents = data.reduce((sum, loc) => sum + loc.count, 0);
    const highImpact = data.reduce((sum, loc) => sum + loc.high_impact_count, 0);
    const hotspots = data.filter(loc => loc.count > 10).length;
    
    return { totalEvents, highImpact, hotspots, regions: data.length };
  }, [data]);

  if (isLoading && data.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading geographic data...</p>
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Time Range */}
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

          {/* Category Filter */}
          {categories.length > 0 && (
            <select
              value={categoryFilter || ''}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
              className="px-3 py-1 text-sm bg-card border border-border rounded"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}

          {/* Refresh */}
          <button
            onClick={fetchLocationData}
            className="px-4 py-1 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Events</p>
            <p className="text-2xl font-bold text-foreground">{stats.totalEvents}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">High Impact</p>
            <p className="text-2xl font-bold text-red-400">{stats.highImpact}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Active Regions</p>
            <p className="text-2xl font-bold text-purple-400">{stats.regions}</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Hotspots</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.hotspots}</p>
          </div>
        </Card>
      </div>

      {/* Map */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Global Event Distribution</h3>
        
        <div className="relative" style={{ height: '500px', backgroundColor: '#1a1a2e' }}>
          <ComposableMap
            projectionConfig={{
              scale: 147,
              rotation: [-10, 0, 0]
            }}
            width={800}
            height={400}
          >
            <ZoomableGroup>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#374151"
                      stroke="#1F2937"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none', fill: '#4B5563' },
                        pressed: { outline: 'none' }
                      }}
                    />
                  ))
                }
              </Geographies>

              {/* Event Markers */}
              {data.map((location) => {
                const [lon, lat] = location.coordinates;
                const size = sizeScale(location.count);
                const color = colorScale(location.count);
                
                return (
                  <Marker
                    key={location.region}
                    coordinates={[lon, lat]}
                    onClick={() => handleMarkerClick(location)}
                    style={{ cursor: 'pointer' }}
                    data-tip={`${location.region}: ${location.count} events`}
                  >
                    <circle
                      r={size}
                      fill={color}
                      fillOpacity={0.7}
                      stroke="#fff"
                      strokeWidth={2}
                      className="transition-all hover:opacity-100"
                    />
                    <text
                      textAnchor="middle"
                      y={size + 15}
                      style={{ fontSize: '10px', fill: '#fff', fontWeight: 'bold' }}
                    >
                      {location.count}
                    </text>
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>

          {/* Tooltip */}
          <ReactTooltip />
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-xs text-muted-foreground">Low Activity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-muted-foreground">Medium Activity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-xs text-muted-foreground">High Activity</span>
          </div>
        </div>
      </Card>

      {/* Selected Region Details */}
      {selectedRegion && (
        <Card className="border-2 border-purple-500">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-4">
                🌍 {selectedRegion.region}
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{selectedRegion.count}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">High Impact Events</p>
                  <p className="text-2xl font-bold text-red-400">{selectedRegion.high_impact_count}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Active Categories:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedRegion.categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-3 py-1 text-sm bg-purple-500/20 text-purple-300 rounded"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedRegion(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </Card>
      )}

      {/* Region List */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">All Regions</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-sm text-muted-foreground">Region</th>
                <th className="text-right py-2 px-3 text-sm text-muted-foreground">Events</th>
                <th className="text-right py-2 px-3 text-sm text-muted-foreground">High Impact</th>
                <th className="text-right py-2 px-3 text-sm text-muted-foreground">Categories</th>
                <th className="text-right py-2 px-3 text-sm text-muted-foreground">Activity</th>
              </tr>
            </thead>
            <tbody>
              {data
                .sort((a, b) => b.count - a.count)
                .map((location) => (
                  <tr
                    key={location.region}
                    className="border-b border-border/50 hover:bg-card/50 cursor-pointer"
                    onClick={() => handleMarkerClick(location)}
                  >
                    <td className="py-2 px-3 text-sm font-medium">{location.region}</td>
                    <td className="py-2 px-3 text-sm text-right">{location.count}</td>
                    <td className="py-2 px-3 text-sm text-right text-red-400">
                      {location.high_impact_count}
                    </td>
                    <td className="py-2 px-3 text-sm text-right">{location.categories.length}</td>
                    <td className="py-2 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: colorScale(location.count) }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default GeographicHeatMap;
```

**Integration**:

```tsx
// File: components/ai/AIManager/tabs/DataHub/TelegramDataPanel.tsx
// Add import
import GeographicHeatMap from './GeographicHeatMap';

// Add a new tab and content
const tabs = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'agents', label: 'AI Agents', icon: '🤖' },
  { id: 'categories', label: 'Categories', icon: '📁' },
  { id: 'breaking', label: 'Breaking News', icon: '🚨' },
  { id: 'geographic', label: 'Geographic Map', icon: '🗺️' },
];

// Add tab content:
{activeTab === 'geographic' && (
  <GeographicHeatMap t={t} Card={Card} />
)}
```

---

### Task A.4: AgentDetailPanel Component

**File to Create**: `components/ai/AIManager/tabs/DataHub/AgentDetailPanel.tsx`

**Complete Implementation**:

```tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';

interface AgentMessage {
  id: string;
  message_id: number;
  channel_title: string;
  cleaned_text: string;
  sentiment: string;
  importance_level: string;
  impact_score: string;
  impact_type: string;
  confidence: string;
  relevance_reasons: string[];
  requires_action: boolean;
  action_type: string | null;
  priority_level: string;
  telegram_created_at: string;
  processed_at: string;
}

interface AgentStats {
  agent_key: string;
  agent_name: string;
  total_messages: number;
  action_required_count: number;
  avg_impact_score: number;
  high_priority_count: number;
  last_activity: string;
}

interface AgentDetailPanelProps {
  agentKey: string;
  agentName: string;
  onClose: () => void;
  t: (key: string) => string;
  Card: React.FC<{ children: React.ReactNode; className?: string }>;
}

const AGENT_ICONS: Record<string, string> = {
  'technical': '📈',
  'trend': '📊',
  'sentiment': '💭',
  'arbitrage': '⚖️',
  'risk': '⚠️',
  'liquidity': '💧',
  'news': '📰',
  'economic': '💰',
  'social': '👥',
  'correlation': '🔗',
  'volatility': '📉',
  'momentum': '🚀',
  'pattern': '🔍',
  'event': '📅',
  'regulatory': '⚖️'
};

const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({
  agentKey,
  agentName,
  onClose,
  t,
  Card
}) => {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(168); // 7 days
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const LIMIT = 20;

  useEffect(() => {
    fetchAgentData();
  }, [agentKey, timeRange, priorityFilter, actionFilter, page]);

  const fetchAgentData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Build query parameters
      let url = `/api/v1/telegram/agents/${agentKey}/feed?timeRange=${timeRange}&limit=${LIMIT}&offset=${(page - 1) * LIMIT}`;
      
      if (priorityFilter) {
        url += `&priority=${priorityFilter}`;
      }
      
      if (actionFilter !== null) {
        url += `&requiresAction=${actionFilter}`;
      }

      const response = await axios.get(url);
      
      if (response.data.success) {
        const newMessages = response.data.data;
        
        // Update messages (append for pagination)
        if (page === 1) {
          setMessages(newMessages);
        } else {
          setMessages(prev => [...prev, ...newMessages]);
        }
        
        // Check if there are more
        setHasMore(newMessages.length === LIMIT);
        
        // Update stats
        if (response.data.stats) {
          setStats(response.data.stats);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch agent data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
  };

  const handleMarkProcessed = async (messageId: string) => {
    try {
      await axios.post(`/api/v1/telegram/agents/${agentKey}/mark-processed`, {
        message_ids: [messageId]
      });
      
      // Remove from list
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err: any) {
      console.error('Failed to mark processed:', err);
    }
  };

  const resetFilters = () => {
    setPriorityFilter(null);
    setActionFilter(null);
    setPage(1);
  };

  const getImpactColor = (score: string) => {
    const numScore = parseFloat(score);
    if (numScore >= 0.7) return 'text-red-400';
    if (numScore >= 0.5) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'critical') return 'bg-red-500';
    if (priority === 'high') return 'bg-orange-500';
    if (priority === 'medium') return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl">
              {AGENT_ICONS[agentKey] || '🤖'}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{agentName}</h2>
              <p className="text-sm text-muted-foreground">Agent Key: {agentKey}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-card hover:bg-card/80 border border-border rounded transition-colors"
          >
            ← Back to Overview
          </button>
        </div>
      </Card>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Messages</p>
              <p className="text-2xl font-bold">{stats.total_messages}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Action Required</p>
              <p className="text-2xl font-bold text-red-400">{stats.action_required_count}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Avg Impact</p>
              <p className={`text-2xl font-bold ${getImpactColor(stats.avg_impact_score.toString())}`}>
                {(stats.avg_impact_score * 100).toFixed(0)}%
              </p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">High Priority</p>
              <p className="text-2xl font-bold text-orange-400">{stats.high_priority_count}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Last Activity</p>
              <p className="text-sm font-medium">
                {stats.last_activity
                  ? formatDistanceToNow(new Date(stats.last_activity), { addSuffix: true })
                  : 'N/A'}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Time Range */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Time:</span>
            {[24, 48, 168, 720].map((hours) => (
              <button
                key={hours}
                onClick={() => {
                  setTimeRange(hours);
                  setPage(1);
                }}
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

          {/* Priority Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Priority:</span>
            <select
              value={priorityFilter || ''}
              onChange={(e) => {
                setPriorityFilter(e.target.value || null);
                setPage(1);
              }}
              className="px-2 py-1 text-sm bg-card border border-border rounded"
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Action:</span>
            <select
              value={actionFilter === null ? '' : actionFilter.toString()}
              onChange={(e) => {
                const val = e.target.value;
                setActionFilter(val === '' ? null : val === 'true');
                setPage(1);
              }}
              className="px-2 py-1 text-sm bg-card border border-border rounded"
            >
              <option value="">All</option>
              <option value="true">Required</option>
              <option value="false">Not Required</option>
            </select>
          </div>

          {/* Reset Filters */}
          <button
            onClick={resetFilters}
            className="px-3 py-1 text-sm bg-card hover:bg-card/80 border border-border rounded transition-colors"
          >
            🔄 Reset Filters
          </button>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Messages Feed */}
      <div className="space-y-4">
        {messages.map((msg) => (
          <Card
            key={msg.id}
            className={`${
              msg.requires_action ? 'border-l-4 border-red-500' : ''
            }`}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Priority Badge */}
                  <span className={`px-2 py-1 text-xs rounded text-white ${getPriorityColor(msg.priority_level)}`}>
                    {msg.priority_level.toUpperCase()}
                  </span>

                  {/* Impact Score */}
                  <span className={`px-2 py-1 text-xs rounded bg-card border border-border ${getImpactColor(msg.impact_score)}`}>
                    Impact: {(parseFloat(msg.impact_score) * 100).toFixed(0)}%
                  </span>

                  {/* Confidence */}
                  <span className="px-2 py-1 text-xs rounded bg-card border border-border text-blue-300">
                    Confidence: {(parseFloat(msg.confidence) * 100).toFixed(0)}%
                  </span>

                  {/* Sentiment */}
                  <span className={`px-2 py-1 text-xs rounded ${
                    msg.sentiment === 'positive' ? 'bg-green-500/20 text-green-300' :
                    msg.sentiment === 'negative' ? 'bg-red-500/20 text-red-300' :
                    'bg-gray-500/20 text-gray-300'
                  }`}>
                    {msg.sentiment === 'positive' ? '😊' : msg.sentiment === 'negative' ? '😟' : '😐'} {msg.sentiment}
                  </span>

                  {/* Action Required */}
                  {msg.requires_action && (
                    <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-300 border border-red-500/50">
                      ⚠️ ACTION REQUIRED
                    </span>
                  )}
                </div>

                {/* Time */}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(msg.telegram_created_at), { addSuffix: true })}
                </span>
              </div>

              {/* Source */}
              <div className="text-xs text-muted-foreground">
                📢 {msg.channel_title} • {msg.impact_type || 'General'}
              </div>

              {/* Message Text */}
              <p className="text-foreground leading-relaxed">{msg.cleaned_text}</p>

              {/* Relevance Reasons */}
              {msg.relevance_reasons && msg.relevance_reasons.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Relevance Reasons:</p>
                  <div className="flex flex-wrap gap-1">
                    {msg.relevance_reasons.map((reason, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded">
                        • {reason}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => handleMarkProcessed(msg.id)}
                  className="px-3 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                >
                  ✓ Mark Processed
                </button>
                <button
                  onClick={() => {
                    // Open message detail
                    console.log('View message detail:', msg.id);
                  }}
                  className="px-3 py-1 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
                >
                  📋 View Details
                </button>
                {msg.requires_action && msg.action_type && (
                  <button
                    onClick={() => {
                      // Execute action
                      console.log('Execute action:', msg.action_type);
                    }}
                    className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                  >
                    🎯 Execute: {msg.action_type}
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Load More */}
      {hasMore && !isLoading && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
          >
            Load More Messages
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
        </div>
      )}

      {/* No Messages */}
      {!isLoading && messages.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">{AGENT_ICONS[agentKey] || '🤖'}</div>
            <p className="text-lg font-semibold mb-2">No Messages Found</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or time range
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AgentDetailPanel;
```

**Integration into TelegramDataPanel**:

```tsx
// File: components/ai/AIManager/tabs/DataHub/TelegramDataPanel.tsx
// Add import
import AgentDetailPanel from './AgentDetailPanel';

// Add state for selected agent
const [selectedAgent, setSelectedAgent] = useState<{key: string; name: string} | null>(null);

// In the agents tab, make agent cards clickable:
{activeTab === 'agents' && (
  selectedAgent ? (
    <AgentDetailPanel
      agentKey={selectedAgent.key}
      agentName={selectedAgent.name}
      onClose={() => setSelectedAgent(null)}
      t={t}
      Card={Card}
    />
  ) : (
    // Existing agent list with onClick handlers
    // ...existing agent grid...
    <Card
      onClick={() => setSelectedAgent({key: agent.agent_key, name: agent.agent_name})}
      className="cursor-pointer hover:ring-2 hover:ring-purple-500"
    >
      {/* existing agent card content */}
    </Card>
  )
)}
```

---

## 📊 OPTION A: SUMMARY & TESTING

### Testing Checklist for Option A

```bash
# 1. Install dependencies
cd /home/ubuntu/webapp/TitanGold
npm install recharts date-fns react-simple-maps react-tooltip d3-geo d3-scale

# 2. Create sound file for alerts
mkdir -p public/sounds
# Download or generate alert.mp3

# 3. Restart frontend
pm2 restart titan-frontend

# 4. Test in browser
# Visit: https://titan.zala.ir/?view=ai
# Navigate to: AI Manager → DataHub → Telegram Tab

# Test each component:
# ✓ CategoryBreakdown: Click categories, change time range, view timeline
# ✓ BreakingNewsMonitor: Enable sound, test filters, acknowledge alerts
# ✓ GeographicHeatMap: Click regions, zoom map, view statistics
# ✓ AgentDetailPanel: Click agent from list, filter messages, mark processed
```

### Files Created for Option A

```
components/ai/AIManager/tabs/DataHub/
├── CategoryBreakdown.tsx          (587 lines, ~20KB)
├── BreakingNewsMonitor.tsx       (1,114 lines, ~40KB)
├── GeographicHeatMap.tsx         (~500 lines, ~18KB)
└── AgentDetailPanel.tsx          (~450 lines, ~16KB)

Total: ~2,651 lines, ~94KB of new code
```

### Estimated Time

- **Task A.1** (CategoryBreakdown): 2-3 hours
- **Task A.2** (BreakingNewsMonitor): 3-4 hours
- **Task A.3** (GeographicHeatMap): 3-4 hours
- **Task A.4** (AgentDetailPanel): 2-3 hours

**Total Option A**: 10-14 hours

---

**Status Update**:
- ✅ Option A: Task A.1 (CategoryBreakdown) - **COMPLETE**
- ✅ Option A: Task A.2 (BreakingNewsMonitor) - **COMPLETE**
- ✅ Option A: Task A.3 (GeographicHeatMap) - **COMPLETE**
- ✅ Option A: Task A.4 (AgentDetailPanel) - **COMPLETE**

**Next**: Continue to Part 3 with Option B (Advanced AI) and Option C (Trading Integration)...

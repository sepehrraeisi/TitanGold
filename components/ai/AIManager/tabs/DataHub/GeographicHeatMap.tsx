import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { formatDataHubQueryError } from './dataHubI18n';
import { DataHubApiError } from '../../../../../services/dataSourcesApi';
import { DataHubAlert, DataHubEmpty } from './dataHubUi';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
// Bundled TopoJSON – no external URL; map loads even when GitHub is blocked
import worldTopology from 'world-atlas/countries-110m.json';

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

// Region to coordinates (kept for possible tooltip/legend)
const REGION_COORDS: Record<string, [number, number]> = {
  NORTH_AMERICA: [-100, 45],
  SOUTH_AMERICA: [-60, -15],
  EUROPE: [10, 50],
  MIDDLE_EAST: [45, 30],
  ASIA: [90, 30],
  AFRICA: [20, 0],
  OCEANIA: [135, -25],
  CENTRAL_ASIA: [65, 45],
  SOUTHEAST_ASIA: [105, 10],
  EAST_ASIA: [115, 35],
};

// Map TopoJSON country name -> our region key (for coloring countries)
const COUNTRY_TO_REGION: Record<string, string> = {
  'United States of America': 'NORTH_AMERICA',
  Canada: 'NORTH_AMERICA',
  Mexico: 'NORTH_AMERICA',
  Cuba: 'NORTH_AMERICA',
  'Dominican Republic': 'NORTH_AMERICA',
  Haiti: 'NORTH_AMERICA',
  Jamaica: 'NORTH_AMERICA',
  Guatemala: 'NORTH_AMERICA',
  Honduras: 'NORTH_AMERICA',
  'Costa Rica': 'NORTH_AMERICA',
  Panama: 'NORTH_AMERICA',
  Brazil: 'SOUTH_AMERICA',
  Argentina: 'SOUTH_AMERICA',
  Chile: 'SOUTH_AMERICA',
  Colombia: 'SOUTH_AMERICA',
  Peru: 'SOUTH_AMERICA',
  Venezuela: 'SOUTH_AMERICA',
  Ecuador: 'SOUTH_AMERICA',
  Bolivia: 'SOUTH_AMERICA',
  Paraguay: 'SOUTH_AMERICA',
  Uruguay: 'SOUTH_AMERICA',
  'United Kingdom': 'EUROPE',
  France: 'EUROPE',
  Germany: 'EUROPE',
  Italy: 'EUROPE',
  Spain: 'EUROPE',
  Poland: 'EUROPE',
  Ukraine: 'EUROPE',
  'Czech Rep.': 'EUROPE',
  Romania: 'EUROPE',
  Netherlands: 'EUROPE',
  Belgium: 'EUROPE',
  Greece: 'EUROPE',
  Portugal: 'EUROPE',
  Sweden: 'EUROPE',
  Norway: 'EUROPE',
  Finland: 'EUROPE',
  Austria: 'EUROPE',
  Switzerland: 'EUROPE',
  Hungary: 'EUROPE',
  'Bosnia and Herz.': 'EUROPE',
  Croatia: 'EUROPE',
  Serbia: 'EUROPE',
  Ireland: 'EUROPE',
  Denmark: 'EUROPE',
  Iceland: 'EUROPE',
  Russia: 'EUROPE',
  Iran: 'MIDDLE_EAST',
  Iraq: 'MIDDLE_EAST',
  'Saudi Arabia': 'MIDDLE_EAST',
  Turkey: 'MIDDLE_EAST',
  Israel: 'MIDDLE_EAST',
  'United Arab Emirates': 'MIDDLE_EAST',
  Syria: 'MIDDLE_EAST',
  Yemen: 'MIDDLE_EAST',
  Jordan: 'MIDDLE_EAST',
  Lebanon: 'MIDDLE_EAST',
  Kuwait: 'MIDDLE_EAST',
  Oman: 'MIDDLE_EAST',
  Qatar: 'MIDDLE_EAST',
  Bahrain: 'MIDDLE_EAST',
  Palestine: 'MIDDLE_EAST',
  Egypt: 'MIDDLE_EAST',
  Libya: 'MIDDLE_EAST',
  China: 'EAST_ASIA',
  Japan: 'EAST_ASIA',
  'South Korea': 'EAST_ASIA',
  'North Korea': 'EAST_ASIA',
  Mongolia: 'EAST_ASIA',
  Taiwan: 'EAST_ASIA',
  India: 'ASIA',
  Pakistan: 'ASIA',
  Bangladesh: 'ASIA',
  Afghanistan: 'ASIA',
  Nepal: 'ASIA',
  'Sri Lanka': 'ASIA',
  Thailand: 'SOUTHEAST_ASIA',
  Vietnam: 'SOUTHEAST_ASIA',
  Indonesia: 'SOUTHEAST_ASIA',
  Malaysia: 'SOUTHEAST_ASIA',
  Philippines: 'SOUTHEAST_ASIA',
  Myanmar: 'SOUTHEAST_ASIA',
  Cambodia: 'SOUTHEAST_ASIA',
  Singapore: 'SOUTHEAST_ASIA',
  Laos: 'SOUTHEAST_ASIA',
  Kazakhstan: 'CENTRAL_ASIA',
  Uzbekistan: 'CENTRAL_ASIA',
  Turkmenistan: 'CENTRAL_ASIA',
  Tajikistan: 'CENTRAL_ASIA',
  Kyrgyzstan: 'CENTRAL_ASIA',
  Australia: 'OCEANIA',
  'New Zealand': 'OCEANIA',
  'Papua New Guinea': 'OCEANIA',
  Fiji: 'OCEANIA',
  'South Africa': 'AFRICA',
  Nigeria: 'AFRICA',
  Kenya: 'AFRICA',
  Ethiopia: 'AFRICA',
  Tanzania: 'AFRICA',
  'Dem. Rep. Congo': 'AFRICA',
  Algeria: 'AFRICA',
  Morocco: 'AFRICA',
  Ghana: 'AFRICA',
  Angola: 'AFRICA',
  Mozambique: 'AFRICA',
  Madagascar: 'AFRICA',
  Cameroon: 'AFRICA',
  'Côte d\'Ivoire': 'AFRICA',
  Sudan: 'AFRICA',
  Uganda: 'AFRICA',
};

const GeographicHeatMap: React.FC<GeographicHeatMapProps> = ({ t, Card }) => {
  const [data, setData] = useState<EventLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(168); // 7 days
  const [selectedRegion, setSelectedRegion] = useState<EventLocation | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const token =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token')
        : null;
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  useEffect(() => {
    fetchLocationData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, categoryFilter]);

  const fetchLocationData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch events and aggregate by region
      let url = `/api/v1/telegram/events/geographic-summary?timeRange=${timeRange}&limit=200`;
      if (categoryFilter) {
        url += `&categories=${categoryFilter}`;
      }

      const response = await axios.get(url, {
        withCredentials: true,
        headers: getAuthHeaders(),
      });

      if (response.data.success) {
        const events = response.data.data;

        // Aggregate by region
        const regionMap = new Map<string, EventLocation>();

        events.forEach((event: any) => {
          const regions = event.regions || [];

          regions.forEach((region: string) => {
            if (regionMap.has(region)) {
              const existing = regionMap.get(region)!;
              existing.count += 1;
              if (event.market_impact_level === 'high') {
                existing.high_impact_count += 1;
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
                coordinates: REGION_COORDS[region] || [0, 0],
              });
            }
          });
        });

        setData(Array.from(regionMap.values()));
      }
    } catch (err: unknown) {
      const queryErr =
        err instanceof DataHubApiError
          ? err
          : new DataHubApiError(
                (err as { response?: { status?: number } })?.response?.status || 0,
                (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
                    ?.message ||
                    (err as Error)?.message ||
                    t('geographic_error'),
            );
      setError(formatDataHubQueryError(t, queryErr)?.message || t('datahub_error_generic'));
    } finally {
      setIsLoading(false);
    }
  };

  // Color scale: country fill by event count (green -> amber -> red)
  const colorScale = useMemo(() => {
    const maxCount = Math.max(...data.map((d) => d.count), 1);
    return scaleLinear<string>()
      .domain([0, maxCount / 2, maxCount])
      .range(['#10B981', '#F59E0B', '#EF4444']);
  }, [data]);

  // Lookup region stats by region key (for coloring and click)
  const regionByKey = useMemo(() => {
    const m = new Map<string, EventLocation>();
    data.forEach((d) => m.set(d.region, d));
    return m;
  }, [data]);

  const defaultFill = '#1F2937';

  const handleCountryClick = (regionKey: string | null) => {
    if (!regionKey) {
      setSelectedRegion(null);
      return;
    }
    const location = regionByKey.get(regionKey) ?? null;
    setSelectedRegion(location === selectedRegion ? null : location);
  };

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    data.forEach((loc) => loc.categories.forEach((cat) => cats.add(cat)));
    return Array.from(cats);
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalEvents = data.reduce((sum, loc) => sum + loc.count, 0);
    const highImpact = data.reduce((sum, loc) => sum + loc.high_impact_count, 0);
    const hotspots = data.filter((loc) => loc.count > 10).length;

    return { totalEvents, highImpact, hotspots, regions: data.length };
  }, [data]);

  if (isLoading && data.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">
            {t('loading_geographic_data') || 'Loading geographic data...'}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <DataHubAlert
          variant="error"
          message={error}
          onRetry={fetchLocationData}
          retryLabel={t('retry') || 'Retry'}
        />
      )}

      {/* Controls */}
      <Card className="bg-slate-950/70 border border-white/5 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Time Range */}
          <div className="flex items-center gap-2">
            <span className="text-xs md:text-sm text-muted-foreground">
              {t('time_range') || 'Time Range'}:
            </span>
            {[24, 48, 168, 720].map((hours) => (
              <button
                key={hours}
                type="button"
                onClick={() => setTimeRange(hours)}
                className={`px-3 py-1 text-xs md:text-sm rounded-full border transition-colors ${
                  timeRange === hours
                    ? 'bg-purple-600/90 border-purple-400/80 text-white shadow-sm'
                    : 'bg-slate-950/60 border-white/10 hover:border-purple-500/60 text-muted-foreground'
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
              className="px-3 py-1 text-xs md:text-sm bg-slate-950/60 border border-white/10 rounded-full text-foreground"
            >
              <option value="">{t('all_categories') || 'All Categories'}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchLocationData}
            className="inline-flex items-center gap-1 px-4 py-1 text-xs md:text-sm rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white shadow-sm border border-white/10 transition-colors"
          >
            <span>🔄</span>
            <span>{t('refresh') || 'Refresh'}</span>
          </button>
        </div>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-slate-900/60 border border-emerald-500/30 shadow-sm">
          <div className="text-center">
            <p className="text-[11px] md:text-xs text-emerald-200/80 mb-1 uppercase tracking-wide">
              {t('total_events') || 'Total Events'}
            </p>
            <p className="text-xl md:text-2xl font-semibold text-emerald-300">
              {stats.totalEvents}
            </p>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-slate-900/60 border border-rose-500/40 shadow-sm">
          <div className="text-center">
            <p className="text-[11px] md:text-xs text-rose-200/90 mb-1 uppercase tracking-wide">
              {t('high_impact_events') || 'High Impact Events'}
            </p>
            <p className="text-xl md:text-2xl font-semibold text-rose-300">
              {stats.highImpact}
            </p>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-slate-900/60 border border-indigo-500/40 shadow-sm">
          <div className="text-center">
            <p className="text-[11px] md:text-xs text-indigo-200/90 mb-1 uppercase tracking-wide">
              {t('active_regions') || 'Active Regions'}
            </p>
            <p className="text-xl md:text-2xl font-semibold text-indigo-300">
              {stats.regions}
            </p>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-slate-900/60 border border-amber-500/40 shadow-sm">
          <div className="text-center">
            <p className="text-[11px] md:text-xs text-amber-200/90 mb-1 uppercase tracking-wide">
              {t('hotspots') || 'Hotspots'}
            </p>
            <p className="text-xl md:text-2xl font-semibold text-amber-300">
              {stats.hotspots}
            </p>
          </div>
        </Card>
      </div>

      {/* Map */}
      <Card className="bg-gradient-to-br from-slate-950/90 via-slate-950/85 to-slate-900/80 border border-white/5 shadow-xl">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h3 className="text-lg font-semibold">
              {t('geographic_map') || 'Global Event Distribution'}
            </h3>
            <p className="text-[11px] md:text-xs text-muted-foreground mt-1">
              {t('geographic_map_hint') ||
                'Country color shows event activity. Click a country to see details.'}
            </p>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-slate-800/80" style={{ height: '500px', backgroundColor: '#020617' }}>
          <ComposableMap
            projectionConfig={{
              scale: 147,
              rotation: [-10, 0, 0],
            }}
            width={800}
            height={400}
          >
            <ZoomableGroup>
              <Geographies geography={worldTopology}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const name = (geo.properties?.name ?? geo.name ?? '') as string;
                    const regionKey = name ? COUNTRY_TO_REGION[name] : null;
                    const loc = regionKey ? regionByKey.get(regionKey) : null;
                    const count = loc?.count ?? 0;
                    const fill = count > 0 ? colorScale(count) : defaultFill;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="#0f172a"
                        strokeWidth={0.4}
                        style={{
                          default: { outline: 'none', cursor: loc ? 'pointer' : 'default' },
                          hover: {
                            outline: 'none',
                            fill: count > 0 ? colorScale(count) : '#334155',
                            filter: 'brightness(1.15)',
                            cursor: loc ? 'pointer' : 'default',
                          },
                          pressed: { outline: 'none' },
                        }}
                        onClick={() => handleCountryClick(regionKey)}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span className="text-[11px] md:text-xs text-muted-foreground">
              {t('low_activity') || 'Low Activity'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500" />
            <span className="text-[11px] md:text-xs text-muted-foreground">
              {t('medium_activity') || 'Medium Activity'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span className="text-[11px] md:text-xs text-muted-foreground">
              {t('high_activity') || 'High Activity'}
            </span>
          </div>
        </div>
      </Card>

      {/* Selected Region Details */}
      {selectedRegion && (
        <Card className="bg-gradient-to-br from-purple-900/70 via-slate-950/90 to-slate-900/80 border border-purple-500/60 shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-4">
                🌍 {selectedRegion.region}
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-900/70 rounded-xl p-3 border border-white/5">
                  <p className="text-[11px] md:text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                    {t('total_events') || 'Total Events'}
                  </p>
                  <p className="text-xl md:text-2xl font-semibold text-foreground">
                    {selectedRegion.count}
                  </p>
                </div>
                <div className="bg-slate-900/70 rounded-xl p-3 border border-rose-500/40">
                  <p className="text-[11px] md:text-xs text-rose-200 mb-1 uppercase tracking-wide">
                    {t('high_impact_events') || 'High Impact Events'}
                  </p>
                  <p className="text-xl md:text-2xl font-semibold text-rose-300">
                    {selectedRegion.high_impact_count}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t('active_categories') || 'Active Categories'}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedRegion.categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-3 py-1 text-xs md:text-sm rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/40"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedRegion(null)}
              className="ml-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              ✕
            </button>
          </div>
        </Card>
      )}

      {/* Region List */}
      <Card className="bg-slate-950/75 border border-white/5 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">
          {t('regions') || 'Regions'}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-sm text-muted-foreground">
                  {t('region') || 'Region'}
                </th>
                <th className="text-right py-2 px-3 text-sm text-muted-foreground">
                  {t('events') || 'Events'}
                </th>
                <th className="text-right py-2 px-3 text-sm text-muted-foreground">
                  {t('high_impact') || 'High Impact'}
                </th>
                <th className="text-right py-2 px-3 text-sm text-muted-foreground">
                  {t('categories') || 'Categories'}
                </th>
                <th className="text-right py-2 px-3 text-sm text-muted-foreground">
                  {t('activity') || 'Activity'}
                </th>
              </tr>
            </thead>
            <tbody>
              {data
                .sort((a, b) => b.count - a.count)
                .map((location) => (
                  <tr
                    key={location.region}
                    className="border-b border-border/50 hover:bg-card/50 cursor-pointer"
                    onClick={() => setSelectedRegion(selectedRegion?.region === location.region ? null : location)}
                  >
                    <td className="py-2 px-3 text-sm font-medium">
                      {location.region}
                    </td>
                    <td className="py-2 px-3 text-sm text-right">
                      {location.count}
                    </td>
                    <td className="py-2 px-3 text-sm text-right text-red-400">
                      {location.high_impact_count}
                    </td>
                    <td className="py-2 px-3 text-sm text-right">
                      {location.categories.length}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: colorScale(location.count) }}
                        />
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


import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts';
import { format } from 'date-fns';

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

interface CategoryTotals {
    total_messages: string;
    total_channels: string;
    total_agents_affected: string;
}

interface CategoryBreakdownProps {
    t: (key: string) => string;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
}

const COLORS = [
    '#8B5CF6',
    '#EC4899',
    '#F59E0B',
    '#10B981',
    '#3B82F6',
    '#6366F1',
    '#EF4444',
    '#14B8A6',
    '#F97316',
    '#06B6D4',
    '#84CC16',
    '#A855F7',
    '#F43F5E',
    '#22C55E',
    '#3B82F6',
];

const CATEGORY_LABELS: Record<string, string> = {
    MARKET_DATA: '📊 Market Data',
    ECONOMIC_INDICATORS: '📈 Economic Indicators',
    GEOPOLITICAL: '🌍 Geopolitical',
    POLITICAL: '🏛️ Political',
    SANCTIONS_EMBARGO: '⛔ Sanctions & Embargo',
    ENERGY_COMMODITIES: '⚡ Energy & Commodities',
    CRYPTO_BLOCKCHAIN: '₿ Crypto & Blockchain',
    FOREX_CURRENCY: '💱 Forex & Currency',
    PRECIOUS_METALS: '🥇 Precious Metals',
    SOCIAL_UNREST: '⚠️ Social Unrest',
    NATURAL_DISASTERS: '🌪️ Natural Disasters',
    CORPORATE_BUSINESS: '🏢 Corporate & Business',
    TECHNOLOGY: '💻 Technology',
    FINANCIAL_CRISIS: '💥 Financial Crisis',
    TRADE_COMMERCE: '🚢 Trade & Commerce',
};

const getCategoryLabel = (categoryKey: string) => CATEGORY_LABELS[categoryKey] || categoryKey;

const splitEmojiAndText = (label: string) => {
    const parts = label.trim().split(' ');
    if (parts.length <= 1) return { emoji: '📰', text: label };
    return { emoji: parts[0], text: parts.slice(1).join(' ') };
};

const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ t, Card }) => {
    const [data, setData] = useState<CategoryData[]>([]);
    const [timeline, setTimeline] = useState<TimelineData[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState(168); // 7 days
    const [isLoading, setIsLoading] = useState(false);
    const [isTimelineLoading, setIsTimelineLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [timelineError, setTimelineError] = useState<string | null>(null);
    const [chartType, setChartType] = useState<'pie' | 'bar' | 'area'>('pie');
    const [totals, setTotals] = useState<CategoryTotals | null>(null);

    const getAuthHeaders = () => {
        const token =
            typeof localStorage !== 'undefined'
                ? localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token')
                : null;
        return token ? { Authorization: `Bearer ${token}` } : undefined;
    };

    useEffect(() => {
        fetchCategoryData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeRange]);

    useEffect(() => {
        if (selectedCategory) {
            fetchTimeline(selectedCategory);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCategory, timeRange]);

    const fetchCategoryData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get(`/api/v1/telegram/categories/summary?timeRange=${timeRange}`, {
                withCredentials: true,
                headers: getAuthHeaders(),
            });
            if (response.data.success) {
                setData(response.data.categories);
                setTotals(response.data.totals || null);
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to fetch category data');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTimeline = async (category: string) => {
        try {
            setIsTimelineLoading(true);
            setTimelineError(null);
            const interval = timeRange > 48 ? 'day' : 'hour';
            const response = await axios.get(
                `/api/v1/telegram/categories/${category}/timeline?timeRange=${timeRange}&interval=${interval}`,
                {
                    withCredentials: true,
                    headers: getAuthHeaders(),
                },
            );
            if (response.data.success) {
                setTimeline(response.data.data);
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to fetch timeline';
            setTimeline([]);
            setTimelineError(msg);
        } finally {
            setIsTimelineLoading(false);
        }
    };

    const pieData = useMemo(
        () =>
            data.map((item) => ({
                name: CATEGORY_LABELS[item.primary_category] || item.primary_category,
                value: parseInt(item.message_count, 10),
                category: item.primary_category,
            })),
        [data],
    );

    const barData = useMemo(
        () =>
            data.map((item) => ({
                category: splitEmojiAndText(getCategoryLabel(item.primary_category)).text,
                high: parseInt(item.high_impact_count, 10),
                medium: parseInt(item.medium_impact_count, 10),
                low: parseInt(item.low_impact_count, 10),
                breaking: parseInt(item.breaking_count, 10),
            })),
        [data],
    );

    const timelineData = useMemo(
        () =>
            [...timeline].reverse().map((item) => ({
                time: format(new Date(item.time_bucket), timeRange > 48 ? 'MMM dd' : 'HH:mm'),
                messages: parseInt(item.message_count, 10),
                high_impact: parseInt(item.high_impact_count, 10),
                agents: parseInt(item.affected_agents, 10),
            })),
        [timeline, timeRange],
    );

    const stats = useMemo(() => {
        const total = data.reduce((sum, item) => sum + parseInt(item.message_count, 10), 0);
        const highImpact = data.reduce((sum, item) => sum + parseInt(item.high_impact_count, 10), 0);
        const breaking = data.reduce((sum, item) => sum + parseInt(item.breaking_count, 10), 0);

        return { total, highImpact, breaking, categories: data.length };
    }, [data]);

    const handleCategoryClick = (category: string) => {
        setSelectedCategory(category === selectedCategory ? null : category);
    };

    if (isLoading && data.length === 0) {
        return (
            <Card className="bg-slate-950/80 border border-white/5 shadow-lg">
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto" />
                    <p className="mt-4 text-muted-foreground text-sm">
                        {t('loading') || 'Loading category data...'}
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-sm font-medium text-red-200 mb-1">{t('error') || 'Error'}</p>
                    <p className="text-[11px] text-red-300">{error}</p>
                </div>
            )}

            {/* Controls */}
            <Card className="bg-slate-950/70 border border-white/5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            {t('time_range') || 'Time Range'}:
                        </span>
                        <div className="flex gap-2">
                            {[24, 48, 168, 720].map((hours) => (
                                <button
                                    key={hours}
                                    type="button"
                                    onClick={() => setTimeRange(hours)}
                                    className={`px-3 py-1 text-xs md:text-sm rounded-full border border-slate-700 transition-colors ${
                                        timeRange === hours
                                            ? 'bg-purple-600 text-white border-purple-500'
                                            : 'bg-slate-950/60 text-muted-foreground hover:bg-slate-900'
                                    }`}
                                >
                                    {hours === 24 ? '24h' : hours === 48 ? '2d' : hours === 168 ? '7d' : '30d'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            {t('view_mode') || 'View'}:
                        </span>
                        {(['pie', 'bar', 'area'] as const).map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setChartType(type)}
                                className={`px-3 py-1 text-xs md:text-sm rounded-full border border-slate-700 transition-colors capitalize ${
                                    chartType === type
                                        ? 'bg-purple-600 text-white border-purple-500'
                                        : 'bg-slate-950/60 text-muted-foreground hover:bg-slate-900'
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={fetchCategoryData}
                        className="ml-auto inline-flex items-center justify-center px-4 py-1.5 text-xs md:text-sm rounded-full font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-colors"
                    >
                        🔄 {t('refresh') || 'Refresh'}
                    </button>
                </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                <Card className="rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent backdrop-blur-sm">
                    <div className="text-center p-3">
                        <p className="text-[11px] text-emerald-300/80 mb-1">
                            {t('total_messages') || 'Categorized Messages'}
                        </p>
                        <p className="text-sm md:text-lg font-semibold text-emerald-100">
                            {stats.total.toLocaleString()}
                        </p>
                    </div>
                </Card>
                <Card className="rounded-xl border border-white/5 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent backdrop-blur-sm">
                    <div className="text-center p-3">
                        <p className="text-[11px] text-red-300/80 mb-1">
                            {t('high_impact') || 'High Impact'}
                        </p>
                        <p className="text-sm md:text-lg font-semibold text-red-200">
                            {stats.highImpact.toLocaleString()}
                        </p>
                    </div>
                </Card>
                <Card className="rounded-xl border border-white/5 bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-transparent backdrop-blur-sm">
                    <div className="text-center p-3">
                        <p className="text-[11px] text-yellow-300/80 mb-1">
                            {t('breaking_news') || 'Breaking'}
                        </p>
                        <p className="text-sm md:text-lg font-semibold text-yellow-200">
                            {stats.breaking.toLocaleString()}
                        </p>
                    </div>
                </Card>
                <Card className="rounded-xl border border-white/5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent backdrop-blur-sm">
                    <div className="text-center p-3">
                        <p className="text-[11px] text-purple-300/80 mb-1">
                            {t('categories') || 'Categories'}
                        </p>
                        <p className="text-sm md:text-lg font-semibold text-purple-200">{stats.categories}</p>
                    </div>
                </Card>
            </div>

            {/* Main chart */}
            <Card className="bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                    <div>
                        <h3 className="text-sm md:text-base font-semibold text-foreground">
                            {t('category_distribution') || 'Category Distribution'} –{' '}
                            {timeRange === 24
                                ? 'Last 24 Hours'
                                : timeRange === 48
                                ? 'Last 2 Days'
                                : timeRange === 168
                                ? 'Last 7 Days'
                                : 'Last 30 Days'}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Click any slice or bar to focus on that category’s timeline below.
                        </p>
                    </div>
                </div>
                {chartType === 'pie' && (
                    <ResponsiveContainer width="100%" height={320}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={110}
                                paddingAngle={2}
                                labelLine={false}
                                onClick={(entry) => handleCategoryClick((entry as any).category)}
                            >
                                {pieData.map((entry, index) => (
                                    <Cell
                                        // eslint-disable-next-line react/no-array-index-key
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                        opacity={
                                            selectedCategory && selectedCategory !== entry.category ? 0.3 : 1
                                        }
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#020617',
                                    border: '1px solid #1f2937',
                                    borderRadius: '0.5rem',
                                }}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                )}

                {chartType === 'bar' && (
                    <ResponsiveContainer width="100%" height={360}>
                        <BarChart data={barData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#020617',
                                    border: '1px solid #1f2937',
                                    borderRadius: '0.5rem',
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
                    <ResponsiveContainer width="100%" height={360}>
                        <AreaChart data={barData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#020617',
                                    border: '1px solid #1f2937',
                                    borderRadius: '0.5rem',
                                }}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="high"
                                stackId="1"
                                stroke="#EF4444"
                                fill="#EF4444"
                                fillOpacity={0.6}
                                name="High"
                            />
                            <Area
                                type="monotone"
                                dataKey="medium"
                                stackId="1"
                                stroke="#F59E0B"
                                fill="#F59E0B"
                                fillOpacity={0.6}
                                name="Medium"
                            />
                            <Area
                                type="monotone"
                                dataKey="low"
                                stackId="1"
                                stroke="#10B981"
                                fill="#10B981"
                                fillOpacity={0.6}
                                name="Low"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </Card>

            {/* Category cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.map((category) => (
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
                                <div className="mt-2 space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            {t('messages') || 'Messages'}:
                                        </span>
                                        <span className="font-medium">
                                            {parseInt(category.message_count, 10).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            {t('high_impact') || 'High Impact'}:
                                        </span>
                                        <span className="font-medium text-red-400">
                                            {category.high_impact_count}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            {t('breaking_news') || 'Breaking'}:
                                        </span>
                                        <span className="font-medium text-yellow-400">
                                            {category.breaking_count}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            {t('affected_agents') || 'Agents'}:
                                        </span>
                                        <span className="font-medium text-purple-400">
                                            {category.affected_agents_count}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Timeline for selected category */}
            {selectedCategory && (
                <Card className="bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg">
                    <div className="flex items-start justify-between mb-4 gap-3">
                        <div>
                            <h3 className="text-sm md:text-base font-semibold text-foreground">
                                {CATEGORY_LABELS[selectedCategory] || selectedCategory} –{' '}
                                {t('timeline') || 'Timeline'}
                            </h3>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                {t('timeline_hint') ||
                                    'Secure, time-bucketed history for this category. Requires an active session to load.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedCategory(null)}
                            className="px-3 py-1.5 text-xs md:text-sm rounded-full border border-slate-700 text-slate-100 bg-slate-900/70 hover:border-purple-400 hover:text-purple-200 transition-colors"
                        >
                            ✕ {t('close') || 'Close'}
                        </button>
                    </div>

                    {timelineError && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                            <p className="text-sm font-medium text-red-200 mb-1">
                                {t('timeline_error') || 'Timeline error'}
                            </p>
                            <p className="text-[11px] text-red-300">{timelineError}</p>
                        </div>
                    )}

                    {isTimelineLoading ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                            <p className="text-xs text-muted-foreground">
                                {t('loading_timeline') || 'Loading timeline…'}
                            </p>
                        </div>
                    ) : timelineData.length === 0 ? (
                        <div className="py-10 text-center">
                            <div className="text-4xl mb-2">
                                {splitEmojiAndText(
                                    CATEGORY_LABELS[selectedCategory] || selectedCategory,
                                ).emoji}
                            </div>
                            <p className="text-sm font-semibold text-foreground mb-1">
                                {t('no_timeline_data') || 'No timeline data yet'}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                                {t('no_timeline_data_hint') ||
                                    'Once more categorized events arrive for this bucket, their history will show up here.'}
                            </p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={timelineData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                <XAxis dataKey="time" stroke="#9ca3af" />
                                <YAxis yAxisId="left" stroke="#9ca3af" />
                                <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#020617',
                                        border: '1px solid #1f2937',
                                        borderRadius: '0.5rem',
                                    }}
                                />
                                <Legend />
                                <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="messages"
                                    stroke="#8B5CF6"
                                    strokeWidth={2}
                                    name={t('messages') || 'Messages'}
                                />
                                <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="high_impact"
                                    stroke="#EF4444"
                                    strokeWidth={2}
                                    name={t('high_impact') || 'High Impact'}
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="agents"
                                    stroke="#10B981"
                                    strokeWidth={2}
                                    name={t('affected_agents') || 'Affected Agents'}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            )}
        </div>
    );
};

export default CategoryBreakdown;


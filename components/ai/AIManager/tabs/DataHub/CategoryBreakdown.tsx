import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { formatDataHubQueryError } from './dataHubI18n';
import { DataHubApiError } from '../../../../../services/dataSourcesApi';
import {
    DATAHUB_SHELL,
    DATAHUB_INNER_LIST,
    DataHubAlert,
    DataHubEmpty,
    DataHubSectionHeader,
    DataHubSegmentedControl,
    DataHubToolbar,
    DataHubFilterBar,
    DataHubLoadingSpinner,
    MetricCard,
    PrimaryButton,
    SecondaryButton,
    formatTimeRangeLabel,
    TIME_RANGE_OPTIONS,
} from './dataHubUi';
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
import {
    formatNewsCategoryLabel,
} from './telegramCollectorLabels';

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

const getCategoryLabel = (categoryKey: string, tr: (k: string) => string) =>
    formatNewsCategoryLabel(categoryKey, tr, true);

const splitEmojiAndText = (label: string) => {
    const parts = label.trim().split(' ');
    if (parts.length <= 1) return { emoji: '📰', text: label };
    return { emoji: parts[0], text: parts.slice(1).join(' ') };
};

const categoryEmoji = (categoryKey: string, tr: (k: string) => string) =>
    splitEmojiAndText(getCategoryLabel(categoryKey, tr)).emoji;

const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ t, Card }) => {
    const [data, setData] = useState<CategoryData[]>([]);
    const [timeline, setTimeline] = useState<TimelineData[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState(24);
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
        } catch (err: unknown) {
            const queryErr =
                err instanceof DataHubApiError
                    ? err
                    : new DataHubApiError(
                          (err as { response?: { status?: number } })?.response?.status || 0,
                          (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
                              ?.message ||
                              (err as Error)?.message ||
                              'Failed to fetch category data',
                      );
            setError(formatDataHubQueryError(t, queryErr)?.message || t('datahub_error_generic'));
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
                name: getCategoryLabel(item.primary_category, t),
                value: parseInt(item.message_count, 10),
                category: item.primary_category,
            })),
        [data],
    );

    const barData = useMemo(
        () =>
            data.map((item) => ({
                category: splitEmojiAndText(getCategoryLabel(item.primary_category, t)).text,
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
            <Card className={DATAHUB_SHELL}>
                <DataHubLoadingSpinner message={t('loading') || 'Loading category data…'} size="lg" />
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {error && <DataHubAlert variant="error" message={error} onRetry={fetchCategoryData} retryLabel={t('retry')} />}

            <Card className={DATAHUB_SHELL}>
                <DataHubToolbar>
                    <DataHubFilterBar>
                        <span className="text-[11px] text-muted-foreground">
                            {t('time_range') || 'Time Range'}:
                        </span>
                        <DataHubSegmentedControl
                            ariaLabel={t('time_range') || 'Time range'}
                            value={timeRange}
                            onChange={setTimeRange}
                            options={TIME_RANGE_OPTIONS.map(hours => ({
                                value: hours,
                                label: formatTimeRangeLabel(hours),
                            }))}
                        />
                        <span className="text-[11px] text-muted-foreground">
                            {t('view_mode') || 'View'}:
                        </span>
                        <DataHubSegmentedControl
                            ariaLabel={t('view_mode') || 'Chart view'}
                            value={chartType}
                            onChange={setChartType}
                            options={(['pie', 'bar', 'area'] as const).map(type => ({
                                value: type,
                                label: type.charAt(0).toUpperCase() + type.slice(1),
                            }))}
                        />
                    </DataHubFilterBar>
                    <PrimaryButton type="button" onClick={fetchCategoryData}>
                        🔄 {t('refresh') || 'Refresh'}
                    </PrimaryButton>
                </DataHubToolbar>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                <MetricCard
                    label={t('total_messages') || 'Categorized Messages'}
                    value={stats.total.toLocaleString()}
                    color="emerald"
                />
                <MetricCard
                    label={t('high_impact') || 'High Impact'}
                    value={stats.highImpact.toLocaleString()}
                    color="red"
                />
                <MetricCard
                    label={t('breaking_news') || 'Breaking'}
                    value={stats.breaking.toLocaleString()}
                    color="amber"
                />
                <MetricCard label={t('categories') || 'Categories'} value={stats.categories} color="purple" />
            </div>

            <Card className={DATAHUB_SHELL}>
                <DataHubSectionHeader
                    title={`${t('category_distribution') || 'Category Distribution'} – ${formatTimeRangeLabel(timeRange)}`}
                    subtitle="Click any slice or bar to focus on that category’s timeline below."
                />
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.map(category => (
                    <Card
                        key={category.primary_category}
                        className={`${DATAHUB_INNER_LIST} cursor-pointer transition-all ${
                            selectedCategory === category.primary_category
                                ? 'ring-2 ring-sky-500/60'
                                : 'hover:ring-1 hover:ring-sky-400/40'
                        }`}
                        onClick={() => handleCategoryClick(category.primary_category)}
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-3xl">
                                {categoryEmoji(category.primary_category, t)}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-sm">
                                    {getCategoryLabel(category.primary_category, t)}
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

            {selectedCategory && (
                <Card className={DATAHUB_SHELL}>
                    <div className="flex items-start justify-between mb-4 gap-3">
                        <DataHubSectionHeader
                            className="mb-0 flex-1"
                            title={`${getCategoryLabel(selectedCategory, t)} – ${t('timeline')}`}
                            subtitle={
                                t('timeline_hint') ||
                                'Secure, time-bucketed history for this category. Requires an active session to load.'
                            }
                        />
                        <SecondaryButton type="button" onClick={() => setSelectedCategory(null)}>
                            ✕ {t('close') || 'Close'}
                        </SecondaryButton>
                    </div>

                    {timelineError && (
                        <DataHubAlert variant="error" message={timelineError} />
                    )}

                    {isTimelineLoading ? (
                        <DataHubLoadingSpinner message={t('loading_timeline') || 'Loading timeline…'} />
                    ) : timelineData.length === 0 ? (
                        <DataHubEmpty
                            message={
                                t('no_timeline_data') ||
                                'No timeline data yet. Once more categorized events arrive, history will show here.'
                            }
                        />
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


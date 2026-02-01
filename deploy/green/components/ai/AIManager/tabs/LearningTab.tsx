import React, { useEffect, useState, useMemo } from 'react';
import * as api from '../../../../services/api.ts';

type Props = {
    t: (key: string) => string;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
};

const LearningTab: React.FC<Props> = ({ t, Card }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [improvementFilter, setImprovementFilter] = useState<'all' | string>('all');
    const [mistakeFilter, setMistakeFilter] = useState<'all' | 'learned' | 'pending'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await api.fetchLearningState();
            setData(result);
        } catch (err: any) {
            console.error('Failed to load learning system:', err);
            setError(err.message || 'Failed to load learning system');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Auto-refresh every 15 seconds
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    const improvements = data?.improvements || [];
    const mistakes = data?.mistakes || [];

    const improvementAreas = useMemo(() => {
        const areas = new Set(improvements.map((i: any) => i.area));
        return Array.from(areas);
    }, [improvements]);

    const filteredImprovements = useMemo(() => {
        return improvements.filter((improvement: any) => {
            if (improvementFilter !== 'all' && improvement.area !== improvementFilter) return false;
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (!improvement.area.toLowerCase().includes(query) &&
                    !improvement.method.toLowerCase().includes(query)) {
                    return false;
                }
            }
            return true;
        });
    }, [improvements, improvementFilter, searchQuery]);

    const filteredMistakes = useMemo(() => {
        return mistakes.filter((mistake: any) => {
            if (mistakeFilter === 'learned' && !mistake.learned) return false;
            if (mistakeFilter === 'pending' && mistake.learned) return false;
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (!mistake.type.toLowerCase().includes(query) &&
                    !(mistake.correction || '').toLowerCase().includes(query)) {
                    return false;
                }
            }
            return true;
        });
    }, [mistakes, mistakeFilter, searchQuery]);

    const handleMarkLearned = async (mistakeId: string) => {
        try {
            await api.markMistakeAsLearned(mistakeId);
            await fetchData(); // Refresh
        } catch (err: any) {
            console.error('Failed to mark mistake as learned:', err);
            alert(t('failed_to_update') || 'Failed to update mistake');
        }
    };

    if (loading && !data) {
        return <Card><div className="text-center p-4">{t('loading') || 'Loading...'}</div></Card>;
    }

    if (error && !data) {
        return (
            <Card>
                <div className="text-center p-4">
                    <p className="text-red-400 mb-3">{error}</p>
                    <button
                        onClick={fetchData}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {t('retry') || 'Retry'}
                    </button>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('learning_system_status') || 'Learning System Status'}</h3>
                        <p className="text-xs text-muted-foreground">{t('learning_desc') || 'Auto-generated from real AI decisions'}</p>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {loading ? (t('loading') || 'Loading...') : (t('refresh') || 'Refresh')}
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Stat label={t('learning_rate') || 'Learning Rate'} value={`${data?.learningRate || 0}%`} />
                    <Stat label={t('adaptation_speed') || 'Adaptation Speed'} value={data?.adaptationSpeed?.toFixed(1) || '0.0'} />
                    <Stat label={t('total_improvements') || 'Improvements'} value={data?.metrics?.totalImprovements || 0} />
                    <Stat label={t('total_mistakes') || 'Mistakes'} value={data?.metrics?.totalMistakes || 0} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-4">
                    <SmallStat label={t('learned') || 'Learned'} value={data?.metrics?.learnedMistakes || 0} valueClass="text-green-400" />
                    <SmallStat label={t('pending') || 'Pending'} value={data?.metrics?.pendingMistakes || 0} valueClass="text-yellow-400" />
                    <SmallStat label={t('auto_generated') || 'Auto-generated'} value={data?.metrics?.autoGenerated || 0} valueClass="text-blue-400" />
                    <SmallStat label={t('manual') || 'Manual'} value={data?.metrics?.manualAnnotations || 0} valueClass="text-purple-400" />
                </div>
                {data?.lastUpdated && (
                    <p className="text-xs text-muted-foreground mt-3">
                        {t('last_updated') || 'Last updated'}: {new Date(data.lastUpdated).toLocaleTimeString()}
                    </p>
                )}
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-foreground">{t('recent_improvements') || 'Recent Improvements'}</h3>
                    <div className="flex gap-2">
                        <select
                            value={improvementFilter}
                            onChange={(e) => setImprovementFilter(e.target.value)}
                            className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                        >
                            <option value="all">{t('all_areas') || 'All Areas'}</option>
                            {improvementAreas.map((area: any) => (
                                <option key={area} value={area}>{area}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder={t('search') || 'Search...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                        />
                    </div>
                </div>
                <div className="space-y-2 text-sm max-h-[300px] overflow-y-auto">
                    {filteredImprovements.length === 0 ? (
                        <p className="text-muted-foreground text-xs">{t('no_improvements') || 'No improvements found'}</p>
                    ) : filteredImprovements.slice(0, 20).map((improvement: any) => (
                        <div key={improvement.id} className="p-3 bg-secondary/40 rounded-md">
                            <div className="flex justify-between items-center">
                                <div className="flex-1">
                                    <p className="font-semibold text-foreground">{improvement.area}</p>
                                    <p className="text-muted-foreground text-xs">{improvement.method}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                                        +{(parseFloat(improvement.impact) || 0).toFixed(1)}
                                    </span>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {improvement.source}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {new Date(improvement.timestamp).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-foreground">{t('recent_mistakes') || 'Recent Mistakes'}</h3>
                    <select
                        value={mistakeFilter}
                        onChange={(e) => setMistakeFilter(e.target.value as any)}
                        className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                    >
                        <option value="all">{t('all') || 'All'}</option>
                        <option value="learned">{t('learned') || 'Learned'}</option>
                        <option value="pending">{t('pending') || 'Pending'}</option>
                    </select>
                </div>
                <div className="space-y-2 text-sm max-h-[300px] overflow-y-auto">
                    {filteredMistakes.length === 0 ? (
                        <p className="text-muted-foreground text-xs">{t('no_mistakes') || 'No mistakes found'}</p>
                    ) : filteredMistakes.slice(0, 20).map((mistake: any) => (
                        <div key={mistake.id} className="p-3 bg-secondary/40 rounded-md">
                            <div className="flex justify-between items-center">
                                <div className="flex-1">
                                    <p className="font-semibold text-foreground">{mistake.type}</p>
                                    {mistake.correction && (
                                        <p className="text-muted-foreground text-xs mt-1">
                                            {t('correction') || 'Correction'}: {mistake.correction}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right flex flex-col gap-2">
                                    <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">
                                        {(parseFloat(mistake.impact) || 0).toFixed(1)}
                                    </span>
                                    {!mistake.learned && (
                                        <button
                                            onClick={() => handleMarkLearned(mistake.id)}
                                            className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-500/30"
                                        >
                                            {t('mark_learned') || 'Mark Learned'}
                                        </button>
                                    )}
                                    {mistake.learned && (
                                        <span className="text-xs text-green-400">✓ {t('learned') || 'Learned'}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-2">
                                <span>{mistake.source}</span>
                                <span>{new Date(mistake.timestamp).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="text-center">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
    </div>
);

const SmallStat: React.FC<{ label: string; value: string | number; valueClass?: string }> = ({ label, value, valueClass }) => (
    <div className="text-center">
        <p className={`text-lg font-bold ${valueClass || 'text-foreground'}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
    </div>
);

export default LearningTab;

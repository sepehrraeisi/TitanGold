import React, { useMemo, useState } from 'react';
import { ArtemisState, LearningSystemState, Improvement, Mistake } from '../../../../types.ts';

type Props = {
    artemis: ArtemisState;
    t: (key: string) => string;
    onRefresh: () => void;
    Card: React.FC<{ children: React.ReactNode; className?: string }>;
};

const LearningTab: React.FC<Props> = ({ artemis, t, onRefresh, Card }) => {
    const learning: LearningSystemState | undefined = artemis.learningSystem;
    const [improvementFilter, setImprovementFilter] = useState<'all' | string>('all');
    const [mistakeFilter, setMistakeFilter] = useState<'all' | 'learned' | 'pending'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    if (!learning) {
        return <Card><p className="text-sm text-muted-foreground">{t('no_data') || 'No data available'}</p></Card>;
    }

    const improvementAreas = useMemo(() => {
        const areas = new Set(learning.improvements.map(i => i.area));
        return Array.from(areas);
    }, [learning.improvements]);

    const filteredImprovements: Improvement[] = useMemo(() => {
        return learning.improvements.filter(improvement => {
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
    }, [learning.improvements, improvementFilter, searchQuery]);

    const filteredMistakes: Mistake[] = useMemo(() => {
        return learning.mistakes.filter(mistake => {
            if (mistakeFilter === 'learned' && !mistake.learned) return false;
            if (mistakeFilter === 'pending' && mistake.learned) return false;
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                if (!mistake.type.toLowerCase().includes(query) &&
                    !mistake.correction.toLowerCase().includes(query)) {
                    return false;
                }
            }
            return true;
        });
    }, [learning.mistakes, mistakeFilter, searchQuery]);

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">{t('learning_system_status') || 'Learning System Status'}</h3>
                        <p className="text-xs text-muted-foreground">{t('learning_desc') || 'Models, training history, and improvements'}</p>
                    </div>
                    <button
                        onClick={onRefresh}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                    >
                        {t('refresh') || 'Refresh'}
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <Stat label={t('total_decisions') || 'Total Decisions'} value={learning.totalDecisions || 0} />
                    <Stat label={t('total_trades') || 'Total Trades'} value={learning.totalTrades || 0} />
                    <Stat label={t('improvements') || 'Improvements'} value={learning.improvements.length} />
                    <Stat label={t('mistakes') || 'Mistakes'} value={learning.mistakes.length} />
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{t('active_learning') || 'Active Learning'}:</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                        learning.activeLearning ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                        {learning.activeLearning ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}
                    </span>
                    <span className="text-muted-foreground ml-4">{t('last_training') || 'Last Training'}:</span>
                    <span className="text-foreground">
                        {learning.lastTraining ? new Date(learning.lastTraining).toLocaleString() : 'N/A'}
                    </span>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-foreground">{t('recent_improvements') || 'Recent Improvements'}</h3>
                        <select
                            value={improvementFilter}
                            onChange={(e) => setImprovementFilter(e.target.value)}
                            className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                        >
                            <option value="all">{t('all_areas') || 'All Areas'}</option>
                            {improvementAreas.map(area => (
                                <option key={area} value={area}>{area}</option>
                            ))}
                        </select>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('search_improvements') || 'Search improvements...'}
                        className="w-full px-2 py-1 mb-2 bg-background border border-border rounded text-xs text-foreground"
                    />
                    {filteredImprovements.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto text-sm text-foreground">
                            {filteredImprovements.slice(0, 10).map(imp => (
                                <div key={imp.id} className="p-3 border border-border rounded-lg">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{imp.area}</p>
                                            <p className="text-xs text-muted-foreground">{imp.method}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {new Date(imp.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-green-400 font-semibold">+{imp.improvement.toFixed(1)}%</span>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {imp.before.toFixed(1)}% → {imp.after.toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-6">
                            {t('no_improvements_found') || 'No improvements found.'}
                        </p>
                    )}
                </Card>

                <Card>
                    <div className="flex justify-between items-center mb-4">
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
                    {filteredMistakes.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto text-sm text-foreground">
                            {filteredMistakes.slice(0, 10).map(m => (
                                <div key={m.id} className="p-3 border border-border rounded-lg">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{t(m.type) || m.type}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{m.correction}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {new Date(m.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2 py-1 rounded-full text-xs ${
                                                m.learned ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                                {m.learned ? t('learned') || 'Learned' : t('pending') || 'Pending'}
                                            </span>
                                            <p className="text-xs text-red-400 mt-1">
                                                Error: {m.error.toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-6">
                            {t('no_mistakes_found') || 'No mistakes found.'}
                        </p>
                    )}
                </Card>
            </div>

            <Card>
                <h3 className="font-semibold text-foreground mb-3">{t('accuracy_history') || 'Accuracy History'}</h3>
                {learning.accuracyHistory?.length ? (
                    <ul className="space-y-2 text-sm text-foreground">
                        {learning.accuracyHistory.slice(-20).map((entry, idx) => (
                            <li key={idx} className="flex justify-between bg-secondary/40 rounded p-2">
                                <span>{entry.date}</span>
                                <span>{entry.accuracy.toFixed(2)}%</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">{t('no_data') || 'No data available'}</p>
                )}
            </Card>

            <Card>
                <h3 className="font-semibold text-foreground mb-3">{t('model_versions') || 'Model Versions'}</h3>
                {learning.modelVersions?.length ? (
                    <div className="space-y-2 text-sm text-foreground">
                        {learning.modelVersions.map((model, idx) => (
                            <div key={idx} className="p-2 rounded bg-secondary/40 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">{model.version}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {model.trainedAt ? new Date(model.trainedAt).toLocaleString() : ''}
                                    </p>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {model.active ? t('active') || 'Active' : t('inactive') || 'Inactive'}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">{t('no_data') || 'No data available'}</p>
                )}
            </Card>
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="text-center p-3 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground mt-1">{value}</p>
    </div>
);

export default LearningTab;


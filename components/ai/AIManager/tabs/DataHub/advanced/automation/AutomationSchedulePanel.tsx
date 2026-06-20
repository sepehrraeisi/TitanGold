import React from 'react';
import { INPUT_CLASS, DataHubToggle } from '../../dataHubUi';

interface AutomationSchedulePanelProps {
    schedule: {
        enabled: boolean;
        interval: number;
        lastRun?: string;
        nextRun?: string;
    };
    isUpdating: boolean;
    onToggle: (enabled: boolean) => void;
    onUpdateInterval: (interval: number) => void;
    canWrite: boolean;
    t: (key: string) => string;
}

const AutomationSchedulePanel: React.FC<AutomationSchedulePanelProps> = ({
    schedule,
    isUpdating,
    onToggle,
    onUpdateInterval,
    canWrite,
    t,
}) => {
    const wgTitle = !canWrite ? t('datahub_requires_admin_trader') : undefined;
    return (
        <div className="rounded-xl border border-purple-500/30 bg-slate-950/70 p-4 mb-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <div>
                    <h4 className="text-[11px] font-semibold text-foreground">
                        {t('automation_schedule_heading')}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-1">{t('automation_schedule_desc')}</p>
                    <p className="text-[10px] text-amber-300 mt-1">{t('automation_schedule_manual_only')}</p>
                </div>
                <DataHubToggle
                    id="automation-schedule-enabled"
                    checked={schedule.enabled}
                    onChange={onToggle}
                    disabled={!canWrite || isUpdating}
                    title={wgTitle}
                    label={
                        schedule.enabled
                            ? t('automation_schedule_enabled')
                            : t('automation_schedule_disabled')
                    }
                />
            </div>

            {schedule.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-800/60">
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1">{t('dispatch_interval')}</p>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={schedule.interval}
                                onChange={e => onUpdateInterval(parseInt(e.target.value, 10) || 1)}
                                className={`${INPUT_CLASS} w-20`}
                                min={1}
                                disabled={isUpdating || !canWrite}
                                title={wgTitle}
                            />
                            <span className="text-[10px] text-muted-foreground">{t('minutes')}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1">{t('last_dispatch')}</p>
                        <p className="text-[11px] font-mono text-foreground">{schedule.lastRun || '—'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground mb-1">{t('next_dispatch')}</p>
                        <p className="text-[11px] font-mono text-purple-300">{schedule.nextRun || '—'}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutomationSchedulePanel;

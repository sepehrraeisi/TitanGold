
import React from 'react';
import { ActionButton } from '../../../../../../ui/action-button';

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
    t: (key: string) => string;
}

const AutomationSchedulePanel: React.FC<AutomationSchedulePanelProps> = ({
    schedule,
    isUpdating,
    onToggle,
    onUpdateInterval,
    t
}) => {
    return (
        <div className="bg-secondary/20 border border-purple-500/30 rounded-lg p-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <div>
                    <h4 className="font-semibold text-foreground text-sm">{t('automation_schedule_heading') || 'Automatic Publishing Schedule'}</h4>
                    <p className="text-xs text-muted-foreground">
                        {t('automation_schedule_desc') || 'Automatically dispatch queue items at regular intervals.'}
                    </p>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        checked={schedule.enabled}
                        onChange={(e) => onToggle(e.target.checked)}
                        disabled={isUpdating}
                        className="rounded"
                    />
                    <span className={schedule.enabled ? 'text-green-400 font-bold' : 'text-muted-foreground'}>
                        {schedule.enabled
                            ? (t('automation_schedule_enabled') || 'Enabled')
                            : (t('automation_schedule_disabled') || 'Disabled')}
                    </span>
                </label>
            </div>

            {schedule.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-border/20">
                    <div>
                        <p className="text-xs text-muted-foreground mb-1.5">{t('dispatch_interval') || 'Dispatch Interval'}</p>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={schedule.interval}
                                onChange={(e) => onUpdateInterval(parseInt(e.target.value))}
                                className="w-20 px-2 py-1 bg-background border border-border rounded text-sm"
                                min="1"
                            />
                            <span className="text-xs text-muted-foreground">{t('minutes') || 'minutes'}</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('last_dispatch') || 'Last Dispatch'}</p>
                        <p className="text-sm font-mono">{schedule.lastRun || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('next_dispatch') || 'Next Dispatch'}</p>
                        <p className="text-sm font-mono text-purple-400">{schedule.nextRun || 'N/A'}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutomationSchedulePanel;

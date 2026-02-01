import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { GoldPublishItem, GoldPublishTemplate, GoldTelegramChannel } from '../../types.ts';
import Button from '../ui/button.tsx';

interface TelegramPublisherProps {
    queue: GoldPublishItem[];
    channels: GoldTelegramChannel[];
    templates: GoldPublishTemplate[];
    defaultChannelId: string;
    lastPublishedAt?: string;
    isPublishing: boolean;
    statusMessageKey?: string | null;
    statusChannelHandle?: string | null;
    onPublish: (channelId: string, templateId?: string) => Promise<void>;
    onClear: () => void;
}

const TelegramPublisher: React.FC<TelegramPublisherProps> = ({
    queue,
    channels,
    templates,
    defaultChannelId,
    lastPublishedAt,
    isPublishing,
    statusMessageKey,
    statusChannelHandle,
    onPublish,
    onClear,
}) => {
    const { t, language } = useLanguage();
    const [selectedChannel, setSelectedChannel] = useState<string>(defaultChannelId);
    const [selectedTemplate, setSelectedTemplate] = useState<string>(templates[0]?.id ?? '');

    useEffect(() => {
        if (channels.some(channel => channel.id === defaultChannelId)) {
            setSelectedChannel(defaultChannelId);
        }
    }, [defaultChannelId, channels]);

    useEffect(() => {
        if (templates.length > 0 && !templates.find(template => template.id === selectedTemplate)) {
            setSelectedTemplate(templates[0].id);
        }
    }, [templates, selectedTemplate]);

    const combinedContent = queue.map(item => item.content).join('\n\n---\n\n');
    const activeChannel = useMemo(() => channels.find(channel => channel.id === selectedChannel) ?? channels[0], [channels, selectedChannel]);
    const formattedLastPublished = lastPublishedAt
        ? new Date(lastPublishedAt).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US', { hour12: false })
        : null;

    const handlePublish = async () => {
        if (!activeChannel || queue.length === 0) {
            return;
        }
        await onPublish(activeChannel.id, selectedTemplate || undefined);
    };

    return (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">{t('publish_to_telegram')}</h3>
                    {formattedLastPublished && (
                        <p className="text-xs text-muted-foreground">{t('gold_last_published', { time: formattedLastPublished })}</p>
                    )}
                </div>
                {queue.length > 0 && (
                    <Button variant="ghost" onClick={onClear} className="h-8 px-3 text-xs">
                        {t('clear')}
                    </Button>
                )}
            </div>

            <div>
                <label className="text-sm font-medium text-muted-foreground">{t('content_to_publish')}</label>
                <textarea
                    readOnly
                    value={combinedContent || t('no_content_selected')}
                    rows={Math.min(Math.max(queue.length * 3, 4), 10)}
                    className="w-full mt-2 p-2 bg-secondary border border-border rounded-md text-sm text-card-foreground resize-none"
                />
                {queue.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">{t('gold_queue_items', { count: queue.length })}</p>
                )}
            </div>

            <div className="grid grid-cols-1 gap-3">
                <div>
                    <label className="text-sm font-medium text-muted-foreground">{t('select_channel')}</label>
                    <select
                        value={activeChannel?.id ?? ''}
                        onChange={event => setSelectedChannel(event.target.value)}
                        className="w-full mt-1 p-2 bg-secondary border border-border rounded-md focus:ring-primary focus:border-primary"
                    >
                        {channels.map(channel => (
                            <option key={channel.id} value={channel.id}>
                                {channel.name} ({channel.handle})
                            </option>
                        ))}
                    </select>
                    {activeChannel && (
                        <div className="mt-2 rounded-md border border-border/60 bg-secondary/60 p-2 text-[11px] text-muted-foreground">
                            <p>{t('gold_channel_subscribers', { count: activeChannel.subscribers.toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US') })}</p>
                            <p>
                                {t('gold_channel_autopost', {
                                    predictions: activeChannel.autoPost.predictions ? t('enabled') : t('disabled'),
                                    news: activeChannel.autoPost.news ? t('enabled') : t('disabled'),
                                    alerts: activeChannel.autoPost.alerts ? t('enabled') : t('disabled'),
                                })}
                            </p>
                        </div>
                    )}
                </div>

                <div>
                    <label className="text-sm font-medium text-muted-foreground">{t('gold_select_template')}</label>
                    <select
                        value={selectedTemplate}
                        onChange={event => setSelectedTemplate(event.target.value)}
                        className="w-full mt-1 p-2 bg-secondary border border-border rounded-md focus:ring-primary focus:border-primary"
                    >
                        {templates.map(template => (
                            <option key={template.id} value={template.id}>
                                {t(template.nameKey)}
                            </option>
                        ))}
                    </select>
                    {selectedTemplate && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {t(templates.find(template => template.id === selectedTemplate)?.descriptionKey ?? '')}
                        </p>
                    )}
                </div>
            </div>

            <Button
                variant="primary"
                onClick={handlePublish}
                disabled={!activeChannel || queue.length === 0 || isPublishing}
                className="w-full"
            >
                {isPublishing ? t('publishing') : t('publish_now')}
            </Button>

            {statusMessageKey && (
                <p className="text-xs text-center text-muted-foreground">
                    {t(statusMessageKey, statusChannelHandle ? { channel: statusChannelHandle } : undefined)}
                </p>
            )}
        </div>
    );
};

export default TelegramPublisher;
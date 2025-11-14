import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

export interface PublishableItem {
    id: string;
    type: 'Prediction' | 'News';
    content: string;
}

interface TelegramPublisherProps {
    queue: PublishableItem[];
    onClear: () => void;
}

const TelegramPublisher: React.FC<TelegramPublisherProps> = ({ queue, onClear }) => {
    const { t } = useLanguage();
    const [selectedChannel, setSelectedChannel] = useState('');
    const [publishStatus, setPublishStatus] = useState('');

    const handlePublish = () => {
        if (!selectedChannel || queue.length === 0) return;
        setPublishStatus('Publishing...');
        setTimeout(() => {
            setPublishStatus(t('post_sent_successfully', { channel: selectedChannel }));
            onClear();
            setTimeout(() => setPublishStatus(''), 3000);
        }, 1000);
    };

    const combinedContent = queue.map(item => item.content).join('\n\n---\n\n');

    return (
        <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">{t('publish_to_telegram')}</h3>
                {queue.length > 0 && (
                     <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">{t('clear')}</button>
                )}
            </div>
            
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-muted-foreground">{t('content_to_publish')}</label>
                    <textarea 
                        readOnly
                        value={combinedContent || t('no_content_selected')}
                        rows={queue.length > 0 ? 8 : 2}
                        className="w-full mt-1 p-2 bg-secondary border border-border rounded-md text-sm text-card-foreground resize-none"
                    />
                </div>
                 <div>
                    <label className="text-sm font-medium text-muted-foreground">{t('select_channel')}</label>
                    <select
                        value={selectedChannel}
                        onChange={(e) => setSelectedChannel(e.target.value)}
                        className="w-full mt-1 p-2 bg-secondary border border-border rounded-md focus:ring-primary focus:border-primary"
                        disabled={queue.length === 0}
                    >
                        <option value="" disabled>{t('select_channel')}</option>
                        <option value="public">{t('public_channel')}</option>
                        <option value="vip">{t('vip_channel')}</option>
                    </select>
                </div>
                <button 
                    onClick={handlePublish}
                    disabled={!selectedChannel || queue.length === 0}
                    className="w-full bg-primary text-primary-foreground font-semibold py-2 rounded-lg disabled:bg-secondary disabled:text-muted-foreground"
                >
                    {t('publish_now')}
                </button>
                {publishStatus && <p className="text-xs text-center text-positive">{publishStatus}</p>}
            </div>
        </div>
    );
};

export default TelegramPublisher;
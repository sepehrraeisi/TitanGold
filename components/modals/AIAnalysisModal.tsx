import React from 'react';
import Modal from './Modal.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { NewsArticle } from '../../types.ts';

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: NewsArticle;
}

const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({ isOpen, onClose, article }) => {
    const { t } = useLanguage();

    const Section: React.FC<{title: string; children: React.ReactNode}> = ({title, children}) => (
        <div>
            <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider">{title}</h4>
            <div className="mt-2 text-sm text-muted-foreground prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ul:list-disc prose-ul:pl-5 prose-li:text-muted-foreground">
                {children}
            </div>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('ai_news_analysis')}>
            <div className="space-y-5">
                <div>
                    <h3 className="text-lg font-bold text-foreground">{article.headline}</h3>
                    <p className="text-xs text-muted-foreground">{article.source} - {article.timestamp}</p>
                </div>

                <Section title={t('ai_summary')}>
                    <p>{article.aiAnalysis.summary}</p>
                </Section>

                <Section title={t('verification_details')}>
                    <p>{article.aiAnalysis.verificationDetails}</p>
                </Section>

                <Section title={t('impact_analysis')}>
                    <p>{article.aiAnalysis.impactAnalysis}</p>
                </Section>

                <Section title={t('key_takeaways')}>
                    <ul>
                        {article.aiAnalysis.keyTakeaways.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                </Section>
                 
                 <div className="pt-4 border-t border-border flex justify-between items-center">
                    <a href={article.link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                        {t('original_source')}
                    </a>
                    <button onClick={onClose} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded-lg text-sm transition-colors">
                        {t('close')}
                    </button>
                 </div>
            </div>
        </Modal>
    );
};

export default AIAnalysisModal;
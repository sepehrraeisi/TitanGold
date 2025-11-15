import React, { useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import type { AnalysisReportTemplate } from '../../types.ts';

interface ReportExportWidgetProps {
    reports: AnalysisReportTemplate[];
    onGenerate: (reportId: string) => void;
    generatingId: string | null;
}

const ReportExportWidget: React.FC<ReportExportWidgetProps> = ({ reports, onGenerate, generatingId }) => {
    const { t, language } = useLanguage();
    const locale = language === 'fa' ? 'fa-IR' : 'en-US';

    const formatter = useMemo(() => new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }), [locale]);

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white">{t('reporting_and_export')}</h3>
            {reports.length === 0 ? (
                <p className="text-xs text-gray-500 mt-3">{t('no_reports_defined')}</p>
            ) : (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
                    {reports.map(report => {
                        const isGenerating = generatingId === report.id;
                        const isPrimary = report.isPrimary;
                        const lastGenerated = report.lastGeneratedAt
                            ? formatter.format(new Date(report.lastGeneratedAt))
                            : null;
                        return (
                            <button
                                key={report.id}
                                type="button"
                                onClick={() => onGenerate(report.id)}
                                disabled={isGenerating}
                                className={`${isPrimary ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700/50 hover:bg-gray-700'} text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex flex-col items-start gap-1`}
                            >
                                <span>{t(report.labelKey)}</span>
                                {lastGenerated && (
                                    <span className="text-[11px] text-gray-300">{t('last_generated', { time: lastGenerated })}</span>
                                )}
                                <span className="text-[11px] text-gray-400 mt-1">{isGenerating ? t('updating') : t('generate_report')}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ReportExportWidget;
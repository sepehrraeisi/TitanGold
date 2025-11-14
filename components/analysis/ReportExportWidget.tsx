import React from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

const ReportExportWidget: React.FC = () => {
    const { t } = useLanguage();

    return (
        <div className="bg-[#1c1e2f] border border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-white">{t('reporting_and_export')}</h3>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <button className="bg-gray-700/50 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg text-sm">{t('export_pdf')}</button>
                <button className="bg-gray-700/50 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg text-sm">{t('export_excel')}</button>
                <button className="bg-gray-700/50 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg text-sm">{t('export_csv')}</button>
                <button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-sm lg:col-start-5">{t('full_report')}</button>
            </div>
        </div>
    );
};

export default ReportExportWidget;
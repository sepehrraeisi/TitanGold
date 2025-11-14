
import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { getGroundedResponse } from '../services/geminiService.ts';
import { useTTS } from '../hooks/useTTS.ts';
import type { GroundingSource } from '../types.ts';

const NewsAndAnalysis: React.FC = () => {
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<{ text: string; sources: GroundingSource[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const { playSpeech, isPlaying } = useTTS();

    const handleSearch = async () => {
        if (!query) return;
        setLoading(true);
        setResult(null);
        try {
            const response = await getGroundedResponse(query);
            setResult(response);
        } catch (error) {
            console.error(error);
            setResult({ text: t('error_occurred'), sources: [] });
        } finally {
            setLoading(false);
        }
    };
    
    const handleSpeak = () => {
        if(result?.text && !isPlaying) {
            playSpeech(result.text);
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="bg-[#161B22] border border-gray-800 rounded-lg p-6">
                <h1 className="text-2xl font-bold text-white">{t('news_title')}</h1>
                <p className="text-gray-400 mt-1 mb-6">{t('news_desc')}</p>
                
                <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                        type="text" 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('search_placeholder')}
                        className="flex-grow p-3 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-md transition-colors">
                        {loading ? '...' : t('search')}
                    </button>
                </div>

                {loading && <div className="text-center text-gray-400 py-10">Loading analysis...</div>}

                {result && (
                    <div className="mt-8">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-white">{t('analysis_result')}</h2>
                            <button onClick={handleSpeak} disabled={isPlaying} className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700/50 hover:bg-gray-700 rounded-full disabled:opacity-50 transition-colors">
                                {isPlaying ? (
                                    <>
                                        <svg className="animate-pulse h-4 w-4 text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18.5V5.5C6 4.94772 6.44772 4.5 7 4.5H8C8.55228 4.5 9 4.94772 9 5.5V18.5C9 19.0523 8.55228 19.5 8 19.5H7C6.44772 19.5 6 19.0523 6 18.5Z M11 20V4C11 3.44772 11.4477 3 12 3H13C13.5523 3 14 3.44772 14 4V20C14 20.5523 13.5523 21 13 21H12C11.4477 21 11 20.5523 11 20Z M16 17V7C16 6.44772 16.4477 6 17 6H18C18.5523 6 19 6.44772 19 7V17C19 17.5523 18.5523 18 18 18H17C16.4477 18 16 17.5523 16 17Z"></path></svg>
                                        <span>{t('speaking')}</span>
                                    </>
                                ) : (
                                    <>
                                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                       <span>{t('read_aloud')}</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="p-5 bg-[#0D111C] rounded-md prose prose-invert max-w-none prose-p:text-gray-300 prose-strong:text-white" dangerouslySetInnerHTML={{ __html: result.text.replace(/\n/g, '<br/>') }}></div>

                        {result.sources.length > 0 && (
                            <div className="mt-6">
                                <h3 className="font-semibold text-gray-300">{t('sources')}:</h3>
                                <ul className="list-disc list-inside mt-2 space-y-2">
                                    {result.sources.map((source, index) => (
                                       source.web && <li key={index}>
                                            <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                                {source.web.title}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewsAndAnalysis;
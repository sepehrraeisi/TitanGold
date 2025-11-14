
import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { analyzeImage, editImage, generateImage, fileToBase64 } from '../services/geminiService.ts';

const ImageTools: React.FC = () => {
    const { t } = useLanguage();

    const [analyzerPrompt, setAnalyzerPrompt] = useState('');
    const [analyzerImage, setAnalyzerImage] = useState<File | null>(null);
    const [analyzerResult, setAnalyzerResult] = useState('');
    const [analyzerLoading, setAnalyzerLoading] = useState(false);

    const [editorPrompt, setEditorPrompt] = useState('');
    const [editorImage, setEditorImage] = useState<File | null>(null);
    const [editorResult, setEditorResult] = useState<string | null>(null);
    const [editorLoading, setEditorLoading] = useState(false);

    const [generatorPrompt, setGeneratorPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'1:1' | '3:4' | '4:3' | '9:16' | '16:9'>('1:1');
    const [generatorResult, setGeneratorResult] = useState<string | null>(null);
    const [generatorLoading, setGeneratorLoading] = useState(false);

    const handleAnalyze = async () => {
        if (!analyzerPrompt || !analyzerImage) return;
        setAnalyzerLoading(true);
        setAnalyzerResult('');
        try {
            const base64 = await fileToBase64(analyzerImage);
            const result = await analyzeImage(analyzerPrompt, base64, analyzerImage.type);
            setAnalyzerResult(result);
        } catch (error) {
            console.error(error);
            setAnalyzerResult(t('error_occurred'));
        } finally {
            setAnalyzerLoading(false);
        }
    };

    const handleEdit = async () => {
        if (!editorPrompt || !editorImage) return;
        setEditorLoading(true);
        setEditorResult(null);
        try {
            const base64 = await fileToBase64(editorImage);
            const result = await editImage(editorPrompt, base64, editorImage.type);
            setEditorResult(result);
        } catch (error) {
            console.error(error);
        } finally {
            setEditorLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!generatorPrompt) return;
        setGeneratorLoading(true);
        setGeneratorResult(null);
        try {
            const result = await generateImage(generatorPrompt, aspectRatio);
            setGeneratorResult(result);
        } catch (error) {
            console.error(error);
        } finally {
            setGeneratorLoading(false);
        }
    };
    
    const ToolCard: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
        <div className="bg-[#161B22] border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="text-gray-400 mt-1 mb-6">{description}</p>
            <div className="space-y-4">{children}</div>
        </div>
    );
    
    const ImagePreview: React.FC<{file: File | null}> = ({file}) => (
        file ? <img src={URL.createObjectURL(file)} alt="Preview" className="mt-4 rounded-lg max-h-60 object-contain mx-auto" /> : null
    );

    return (
        <div className="p-4 sm:p-6 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ToolCard title={t('image_analyzer')} description={t('image_analyzer_desc')}>
                <input type="file" onChange={(e) => setAnalyzerImage(e.target.files?.[0] || null)} className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 w-full text-gray-400 cursor-pointer"/>
                <ImagePreview file={analyzerImage} />
                <textarea value={analyzerPrompt} onChange={(e) => setAnalyzerPrompt(e.target.value)} placeholder={t('prompt')} className="w-full mt-2 p-3 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"/>
                <button onClick={handleAnalyze} disabled={analyzerLoading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-md transition-colors">{analyzerLoading ? '...' : t('analyze')}</button>
                {analyzerResult && <div className="mt-4 p-4 bg-[#0D111C] rounded-md whitespace-pre-wrap"><h3 className="font-semibold mb-2 text-white">{t('analysis_result')}</h3><p className="text-gray-300">{analyzerResult}</p></div>}
            </ToolCard>

            <ToolCard title={t('image_editor')} description={t('image_editor_desc')}>
                 <input type="file" onChange={(e) => setEditorImage(e.target.files?.[0] || null)} className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 w-full text-gray-400 cursor-pointer"/>
                <ImagePreview file={editorImage} />
                <textarea value={editorPrompt} onChange={(e) => setEditorPrompt(e.target.value)} placeholder={t('prompt')} className="w-full mt-2 p-3 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"/>
                <button onClick={handleEdit} disabled={editorLoading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-md transition-colors">{editorLoading ? '...' : t('edit')}</button>
                {editorResult && <div className="mt-4"><h3 className="font-semibold mb-2 text-white">{t('edited_image')}</h3><img src={`data:image/jpeg;base64,${editorResult}`} alt="Edited" className="rounded-lg" /></div>}
                {editorLoading && <p className="text-center mt-4 text-blue-400">{t('image_loading')}</p>}
            </ToolCard>

            <ToolCard title={t('image_generator')} description={t('image_generator_desc')}>
                <textarea value={generatorPrompt} onChange={(e) => setGeneratorPrompt(e.target.value)} placeholder={t('prompt')} className="w-full p-3 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500"/>
                <div>
                    <label className="text-sm font-medium text-gray-300">{t('aspect_ratio')}</label>
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as any)} className="w-full mt-1 p-3 bg-[#0D111C] border border-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500">
                        <option value="1:1">1:1 (Square)</option>
                        <option value="3:4">3:4 (Portrait)</option>
                        <option value="4:3">4:3 (Landscape)</option>
                        <option value="9:16">9:16 (Tall)</option>
                        <option value="16:9">16:9 (Wide)</option>
                    </select>
                </div>
                <button onClick={handleGenerate} disabled={generatorLoading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-md transition-colors">{generatorLoading ? '...' : t('generate')}</button>
                {generatorResult && <div className="mt-4"><h3 className="font-semibold mb-2 text-white">{t('generated_image')}</h3><img src={`data:image/jpeg;base64,${generatorResult}`} alt="Generated" className="rounded-lg" /></div>}
                 {generatorLoading && <p className="text-center mt-4 text-blue-400">{t('image_loading')}</p>}
            </ToolCard>
        </div>
    );
};

export default ImageTools;
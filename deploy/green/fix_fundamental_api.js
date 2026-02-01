import { readFileSync, writeFileSync } from 'fs';

const filePath = './services/api.ts';
let content = readFileSync(filePath, 'utf8');

// Replace fetchFundamentalAgentData to use backend API
const oldFetch = `export const fetchFundamentalAgentData = async (agentId: string): Promise<{
    config: FundamentalAnalysisConfig | null;
    metrics: FundamentalAnalysisMetrics | null;
    lastAnalysis: FundamentalAnalysisResult | null;
}> => {
    try {
        const agent = await database.get<AIAgent>('aiAgents', agentId);
        if (agent) {
            return {
                config: agent.fundamentalAnalysisConfig || null,
                metrics: agent.fundamentalMetrics || null,
                lastAnalysis: agent.lastFundamentalAnalysis || null,
            };
        }
    } catch (e) {
        console.warn('Failed to fetch fundamental agent data:', e);
    }
    return { config: null, metrics: null, lastAnalysis: null };
};`;

const newFetch = `export const fetchFundamentalAgentData = async (agentId: string): Promise<{
    config: FundamentalAnalysisConfig | null;
    metrics: FundamentalAnalysisMetrics | null;
    lastAnalysis: FundamentalAnalysisResult | null;
}> => {
    try {
        const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
        if (!token) throw new Error('No auth token');
        
        const response = await fetch(\`/api/ai-agents/\${agentId}/details\`, {
            headers: { 'Authorization': \`Bearer \${token}\` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch details');
        
        const data = await response.json();
        return {
            config: data.agent?.config || null,
            metrics: data.metrics || null,
            lastAnalysis: data.lastAnalysis || null
        };
    } catch (e) {
        console.warn('Failed to fetch fundamental agent data:', e);
        return { config: null, metrics: null, lastAnalysis: null };
    }
};`;

content = content.replace(oldFetch, newFetch);

// Replace updateFundamentalAnalysisConfig to use backend API
const oldUpdate = `export const updateFundamentalAnalysisConfig = async (
    agentId: string,
    config: FundamentalAnalysisConfig,
): Promise<void> => {
    try {
        const agent = await database.get<AIAgent>('aiAgents', agentId);
        if (!agent) throw new Error('Agent not found');
        await database.save('aiAgents', {
            ...agent,
            fundamentalAnalysisConfig: config,
            lastUpdate: new Date().toISOString(),
        });
    } catch (e) {
        console.error('Failed to update fundamental analysis config:', e);
        throw e;
    }
};`;

const newUpdate = `export const updateFundamentalAnalysisConfig = async (
    agentId: string,
    config: FundamentalAnalysisConfig,
): Promise<void> => {
    try {
        const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
        if (!token) throw new Error('No auth token');
        
        const response = await fetch(\`/api/ai-agents/\${agentId}/config\`, {
            method: 'PATCH',
            headers: {
                'Authorization': \`Bearer \${token}\`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ config })
        });
        
        if (!response.ok) throw new Error('Failed to update config');
    } catch (e) {
        console.error('Failed to update fundamental analysis config:', e);
        throw e;
    }
};`;

content = content.replace(oldUpdate, newUpdate);

// runFundamentalAnalysis already calls backend, but let's verify it doesn't use database
const oldRun = /await database\.get<AIAgent>\('aiAgents', agentId\);[\s\S]*?if \(!agent \|\| !agent\.fundamentalAnalysisConfig\)/;

// If it exists, it means runFundamentalAnalysis still uses IndexedDB
if (oldRun.test(content)) {
    console.log('⚠️ runFundamentalAnalysis still uses IndexedDB - needs update');
} else {
    console.log('✅ runFundamentalAnalysis already uses backend API');
}

writeFileSync(filePath, content, 'utf8');
console.log('✅ Updated fetchFundamentalAgentData to use backend API');
console.log('✅ Updated updateFundamentalAnalysisConfig to use backend API');

import { readFileSync, writeFileSync } from 'fs';

const filePath = './services/api.ts';
const content = readFileSync(filePath, 'utf8');

const oldCode = `export const fetchArbitrageAgentData = async (agentId: string): Promise<{
    config: ArbitrageConfig | null;
    metrics: ArbitrageMetrics | null;
    lastScan: ArbitrageScanResult | null;
}> => {
    try {
        const agent = await database.get<AIAgent>('aiAgents', agentId);
        if (agent) {
            return {
                config: agent.arbitrageConfig || null,
                metrics: agent.arbitrageMetrics || null,
                lastScan: agent.lastArbitrageScan || null,
            };
        }
    } catch (e) {
        console.warn('Failed to fetch arbitrage agent data:', e);
    }
    return { config: null, metrics: null, lastScan: null };
};`;

const newCode = `export const fetchArbitrageAgentData = async (agentId: string): Promise<{
    config: ArbitrageConfig | null;
    metrics: ArbitrageMetrics | null;
    lastScan: ArbitrageScanResult | null;
}> => {
    try {
        const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
        if (!token) {
            throw new Error('Authentication required');
        }

        console.log('📊 Fetching arbitrage agent data from backend...');

        // Call backend /details endpoint
        const response = await fetch(\`/api/ai-agents/\${agentId}/details\`, {
            method: 'GET',
            headers: {
                'Authorization': \`Bearer \${token}\`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(\`Failed to fetch arbitrage data: \${response.status}\`);
        }

        const data = await response.json();
        
        console.log('✅ Arbitrage data loaded from backend');

        return {
            config: data.agent?.config || null,
            metrics: data.metrics || null,
            lastScan: data.lastScan || null
        };
    } catch (e) {
        console.warn('Failed to fetch arbitrage agent data:', e);
        return { config: null, metrics: null, lastScan: null };
    }
};`;

const updatedContent = content.replace(oldCode, newCode);

if (updatedContent !== content) {
    writeFileSync(filePath, updatedContent, 'utf8');
    console.log('✅ Updated fetchArbitrageAgentData to use backend API');
} else {
    console.log('❌ No changes made - pattern not found');
}

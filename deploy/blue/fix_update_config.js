import { readFileSync, writeFileSync } from 'fs';

const filePath = './services/api.ts';
const content = readFileSync(filePath, 'utf8');

const oldCode = `export const updateArbitrageConfig = async (
    agentId: string,
    config: ArbitrageConfig,
): Promise<void> => {
    try {
        const agent = await database.get<AIAgent>('aiAgents', agentId);
        if (!agent) throw new Error('Agent not found');
        await database.save('aiAgents', {
            ...agent,
            arbitrageConfig: config,
            lastUpdate: new Date().toISOString(),
        });
    } catch (e) {
        console.error('Failed to update arbitrage config:', e);
        throw e;
    }
};`;

const newCode = `export const updateArbitrageConfig = async (
    agentId: string,
    config: ArbitrageConfig,
): Promise<void> => {
    try {
        const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
        if (!token) {
            throw new Error('Authentication required');
        }

        console.log('🔧 Updating arbitrage config via backend...');

        const response = await fetch(\`/api/ai-agents/\${agentId}/config\`, {
            method: 'PATCH',
            headers: {
                'Authorization': \`Bearer \${token}\`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ config })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to update config');
        }

        console.log('✅ Arbitrage config updated successfully');
    } catch (e) {
        console.error('Failed to update arbitrage config:', e);
        throw e;
    }
};`;

const updatedContent = content.replace(oldCode, newCode);

if (updatedContent !== content) {
    writeFileSync(filePath, updatedContent, 'utf8');
    console.log('✅ Updated updateArbitrageConfig to use backend API');
} else {
    console.log('❌ No changes made - pattern not found');
}

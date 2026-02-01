import { readFileSync, writeFileSync } from 'fs';

const filePath = './services/api.ts';
let content = readFileSync(filePath, 'utf8');

// Find the entire runArbitrageAnalysis function
const startMarker = 'export const runArbitrageAnalysis = async (agentId: string): Promise<ArbitrageScanResult> => {';
const startIndex = content.indexOf(startMarker);

if (startIndex === -1) {
    console.log('❌ runArbitrageAnalysis not found');
    process.exit(1);
}

// Find the end of the function (next export or end of file)
const searchStart = startIndex + startMarker.length;
let braceCount = 1;
let endIndex = searchStart;

for (let i = searchStart; i < content.length; i++) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;
    if (braceCount === 0) {
        endIndex = i + 1;
        break;
    }
}

// Find next line after closing brace
while (endIndex < content.length && content[endIndex] !== '\n') {
    endIndex++;
}
endIndex++; // Include the newline

const oldFunction = content.substring(startIndex, endIndex);

const newFunction = `export const runArbitrageAnalysis = async (agentId: string): Promise<ArbitrageScanResult> => {
    try {
        const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
        if (!token) {
            throw new Error('Authentication required');
        }

        console.log('🔍 Running arbitrage analysis for agent:', agentId);

        // Call backend endpoint (to be created)
        const response = await fetch(\`/api/ai-agents/\${agentId}/run\`, {
            method: 'POST',
            headers: {
                'Authorization': \`Bearer \${token}\`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                symbol: 'BTCUSDT', // Default for now
                timeframe: '1h',
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to run arbitrage analysis');
        }

        const data = await response.json();
        
        // Transform backend response to ArbitrageScanResult format
        return {
            timestamp: data.timestamp || new Date().toISOString(),
            opportunities: data.opportunities || [],
            exchangesChecked: data.exchangesChecked || ['mexc'],
            symbolsChecked: data.symbolsChecked || ['BTCUSDT'],
            avgRiskScore: data.avgRiskScore || 0,
            netProfitPotentialUSDT: data.netProfitPotentialUSDT || 0,
            avgExecutionMs: data.avgExecutionMs || 0,
        };
    } catch (error) {
        console.error('❌ Failed to run arbitrage analysis:', error);
        throw error;
    }
};
`;

content = content.substring(0, startIndex) + newFunction + content.substring(endIndex);

writeFileSync(filePath, content, 'utf8');
console.log('✅ Replaced runArbitrageAnalysis with backend call');

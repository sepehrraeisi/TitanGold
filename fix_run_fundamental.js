import { readFileSync, writeFileSync } from 'fs';

const filePath = './services/api.ts';
let content = readFileSync(filePath, 'utf8');

// Find the start of runFundamentalAnalysis
const startMarker = 'export const runFundamentalAnalysis = async (agentId: string): Promise<FundamentalAnalysisResult> => {';
const startIndex = content.indexOf(startMarker);

if (startIndex === -1) {
  console.log('❌ Could not find runFundamentalAnalysis');
  process.exit(1);
}

// Find the end (next export or end of file)
const searchFrom = startIndex + startMarker.length;
const nextExportIndex = content.indexOf('\nexport ', searchFrom);
const endIndex = nextExportIndex > 0 ? nextExportIndex : content.length;

const oldFunction = content.substring(startIndex, endIndex);

const newFunction = `export const runFundamentalAnalysis = async (agentId: string): Promise<FundamentalAnalysisResult> => {
    try {
        const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
        if (!token) throw new Error('Authentication required');
        
        console.log('🚀 Running fundamental analysis for agent:', agentId);
        
        const response = await fetch(\`/api/ai-agents/\${agentId}/run\`, {
            method: 'POST',
            headers: {
                'Authorization': \`Bearer \${token}\`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ symbol: 'BTCUSDT' }) // Default symbol
        });
        
        if (!response.ok) {
            throw new Error(\`Run failed: \${response.status}\`);
        }
        
        const result = await response.json();
        
        // Extract the actual analysis result from the response
        return result.result || result;
    } catch (error) {
        console.error('❌ Failed to run fundamental analysis:', error);
        throw error;
    }
};

`;

content = content.substring(0, startIndex) + newFunction + content.substring(endIndex);

writeFileSync(filePath, content, 'utf8');
console.log('✅ Replaced runFundamentalAnalysis with backend API call');
console.log(`📏 Reduced from ${oldFunction.length} to ${newFunction.length} characters`);

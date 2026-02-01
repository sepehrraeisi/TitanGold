import { readFileSync, writeFileSync } from 'fs';

const filePath = './services/api.ts';
let content = readFileSync(filePath, 'utf8');

// Fix the fetchAIAgents function to handle { agents: [...] } response
const oldCode = `        if (response.ok) {
            const data = await response.json();
            // If backend returns valid data (array), use it (sanitized)
            if (Array.isArray(data) && data.length > 0) {
                const agents = sanitizeAIAgents(data);
                console.log('✅ AI agents loaded from backend:', agents.length);
                return agents;
            }
            // If empty array, return it (no fallback needed)
            if (Array.isArray(data)) {
                console.log('✅ AI agents loaded from backend (empty)');
                return [];
            }`;

const newCode = `        if (response.ok) {
            const data = await response.json();
            // Backend now returns { agents: [...] } for consistency
            const agentsArray = data.agents || data;
            
            // If backend returns valid data (array), use it (sanitized)
            if (Array.isArray(agentsArray) && agentsArray.length > 0) {
                const agents = sanitizeAIAgents(agentsArray);
                console.log('✅ AI agents loaded from backend:', agents.length);
                return agents;
            }
            // If empty array, return it (no fallback needed)
            if (Array.isArray(agentsArray)) {
                console.log('✅ AI agents loaded from backend (empty)');
                return [];
            }`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    writeFileSync(filePath, content, 'utf8');
    console.log('✅ Fixed fetchAIAgents to handle {agents:[]} response');
} else {
    console.log('⚠️ Pattern not found - might be already fixed');
}

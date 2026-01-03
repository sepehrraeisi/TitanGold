import { readFileSync, writeFileSync } from 'fs';

const filePath = './services/api.ts';
let content = readFileSync(filePath, 'utf8');

const oldCode = `const getMexcApiUrl = (endpoint: string): string => {
    // In development, use Vite proxy to avoid CORS issues
    if (import.meta.env.DEV) {
        return \`/api/mexc\${endpoint}\`;
    }
    // In production, use direct API (if CORS is configured)
    return \`\${MEXC_API_BASE}\${endpoint}\`;
};`;

const newCode = `const getMexcApiUrl = (endpoint: string): string => {
    // Always use backend proxy to avoid CORS issues
    // Backend proxies requests to MEXC API at /api/market/mexc/*
    // Map /api/v3/ticker/24hr -> /api/market/mexc/ticker24hr
    const proxyEndpoint = endpoint
        .replace('/api/v3/ticker/24hr', '/ticker24hr')
        .replace('/api/v3/depth', '/depth')
        .replace('/api/v3/exchangeInfo', '/exchangeInfo')
        .replace('/api/v3/ticker/price', '/price');
    
    return \`/api/market/mexc\${proxyEndpoint}\`;
};`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    writeFileSync(filePath, content, 'utf8');
    console.log('✅ Fixed getMexcApiUrl to use backend proxy');
} else {
    console.log('⚠️ Pattern not found - might be already fixed or different');
}

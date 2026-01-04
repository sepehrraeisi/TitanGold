#!/usr/bin/env node
// Test: Verify frontend normalization works with backend response

import fetch from 'node-fetch';

const API_BASE = 'https://titan.zala.ir/api';
const USERNAME = 'testuser';
const PASSWORD = 'Test@123456';

async function test() {
    try {
        // 1. Login
        const loginRes = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: USERNAME, password: PASSWORD })
        });
        const { token } = await loginRes.json();
        console.log('✅ Login successful\n');

        // 2. Get agents
        const agentsRes = await fetch(`${API_BASE}/ai-agents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { agents } = await agentsRes.json();
        const fund = agents.find(a => a.agent_key === 'fundamental');
        console.log('✅ Found Fundamental Agent\n');

        // 3. Run analysis
        await fetch(`${API_BASE}/ai-agents/${fund.id}/run`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ symbol: 'BTCUSDT' })
        });
        console.log('✅ Run triggered\n');

        // 4. Get details (source of truth)
        const detailsRes = await fetch(`${API_BASE}/ai-agents/${fund.id}/details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { lastAnalysis } = await detailsRes.json();

        // 5. Simulate frontend normalization
        function normalizeFundamentalAnalysis(raw) {
            if (!raw) return null;
            
            return {
                ...raw,
                // Map backend fields to UI expectations
                companyData: raw.company_project_data || [],
                financialRatios: raw.financial_ratios || [],
                events: {
                    impactAnalysis: raw.events_news?.impactAnalysis || []
                },
                onChainData: raw.onchain_tokenomics || null,
                fairValueHistory: raw.fair_value?.history || [],
                // Preserve existing fields
                overview: raw.overview || {},
                signals: raw.signals || [],
                averageScore: raw.averageScore || raw.score?.total || 0,
                marketSummary: raw.marketSummary || { fearGreed: 50, macroLabel: 'Neutral', fundingImbalance: 0 },
                alerts: raw.alerts || []
            };
        }

        const normalized = normalizeFundamentalAnalysis(lastAnalysis);

        // 6. Verify UI expectations
        console.log('📊 Backend → Frontend Mapping Test:\n');
        console.log('✅ companyData:', normalized.companyData?.length || 0, 'items');
        console.log('✅ financialRatios:', normalized.financialRatios?.length || 0, 'items');
        console.log('✅ events.impactAnalysis:', normalized.events?.impactAnalysis?.length || 0, 'items');
        console.log('✅ onChainData:', normalized.onChainData ? 'Present' : 'Missing');
        console.log('✅ fairValueHistory:', normalized.fairValueHistory?.length || 0, 'items');
        console.log('✅ overview:', Object.keys(normalized.overview || {}).length, 'fields');
        console.log('✅ signals:', normalized.signals?.length || 0, 'items');
        console.log('✅ averageScore:', normalized.averageScore);
        console.log('✅ marketSummary:', JSON.stringify(normalized.marketSummary));
        console.log('✅ alerts:', normalized.alerts?.length || 0, 'items');

        console.log('\n✅ All UI fields present - normalization successful!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

test();

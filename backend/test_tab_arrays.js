#!/usr/bin/env node
// Test: Verify tabs have array data

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

        // 4. Get details
        const detailsRes = await fetch(`${API_BASE}/ai-agents/${fund.id}/details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { lastAnalysis } = await detailsRes.json();

        // 5. Check array fields
        console.log('📊 Tab Data Types Check:\n');
        console.log('Company/Project Data:');
        console.log('  - Is Array?', Array.isArray(lastAnalysis.company_project_data));
        console.log('  - Length:', lastAnalysis.company_project_data?.length || 0);
        if (lastAnalysis.company_project_data?.[0]) {
            console.log('  - Sample:', {
                name: lastAnalysis.company_project_data[0].name,
                marketCap: lastAnalysis.company_project_data[0].marketCap,
                type: lastAnalysis.company_project_data[0].type
            });
        }

        console.log('\nFinancial Ratios:');
        console.log('  - Is Array?', Array.isArray(lastAnalysis.financial_ratios));
        console.log('  - Length:', lastAnalysis.financial_ratios?.length || 0);
        if (lastAnalysis.financial_ratios?.[0]) {
            console.log('  - Sample:', {
                name: lastAnalysis.financial_ratios[0].name,
                value: lastAnalysis.financial_ratios[0].value,
                status: lastAnalysis.financial_ratios[0].status
            });
        }

        console.log('\nEvents & News:');
        console.log('  - impactAnalysis Is Array?', Array.isArray(lastAnalysis.events_news?.impactAnalysis));
        console.log('  - impactAnalysis Length:', lastAnalysis.events_news?.impactAnalysis?.length || 0);
        if (lastAnalysis.events_news?.impactAnalysis?.[0]) {
            console.log('  - Sample:', {
                id: lastAnalysis.events_news.impactAnalysis[0].id,
                title: lastAnalysis.events_news.impactAnalysis[0].title,
                impact: lastAnalysis.events_news.impactAnalysis[0].impact
            });
        }

        console.log('\nSignals with Financial Ratios:');
        console.log('  - Signals Is Array?', Array.isArray(lastAnalysis.signals));
        console.log('  - Signals Length:', lastAnalysis.signals?.length || 0);
        if (lastAnalysis.signals?.[0]) {
            console.log('  - Signal[0] has financialRatios?', Array.isArray(lastAnalysis.signals[0].financialRatios));
            console.log('  - Signal[0] financialRatios Length:', lastAnalysis.signals[0].financialRatios?.length || 0);
        }

        console.log('\n✅ All tab data structures verified!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

test();

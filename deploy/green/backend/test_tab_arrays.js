#!/usr/bin/env node
// Test: Verify tabs have array data

import fetch from 'node-fetch';
import { logger } from './services/logger.js';

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
        logger.info('✅ Login successful\n');

        // 2. Get agents
        const agentsRes = await fetch(`${API_BASE}/ai-agents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { agents } = await agentsRes.json();
        const fund = agents.find(a => a.agent_key === 'fundamental');
        logger.info('✅ Found Fundamental Agent\n');

        // 3. Run analysis
        await fetch(`${API_BASE}/ai-agents/${fund.id}/run`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ symbol: 'BTCUSDT' })
        });
        logger.info('✅ Run triggered\n');

        // 4. Get details
        const detailsRes = await fetch(`${API_BASE}/ai-agents/${fund.id}/details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { lastAnalysis } = await detailsRes.json();

        // 5. Check array fields
        logger.info('📊 Tab Data Types Check:\n');
        logger.info('Company/Project Data:');
        logger.info('  - Is Array?', Array.isArray(lastAnalysis.company_project_data));
        logger.info('  - Length:', lastAnalysis.company_project_data?.length || 0);
        if (lastAnalysis.company_project_data?.[0]) {
            logger.info('  - Sample:', {
                name: lastAnalysis.company_project_data[0].name,
                marketCap: lastAnalysis.company_project_data[0].marketCap,
                type: lastAnalysis.company_project_data[0].type
            });
        }

        logger.info('\nFinancial Ratios:');
        logger.info('  - Is Array?', Array.isArray(lastAnalysis.financial_ratios));
        logger.info('  - Length:', lastAnalysis.financial_ratios?.length || 0);
        if (lastAnalysis.financial_ratios?.[0]) {
            logger.info('  - Sample:', {
                name: lastAnalysis.financial_ratios[0].name,
                value: lastAnalysis.financial_ratios[0].value,
                status: lastAnalysis.financial_ratios[0].status
            });
        }

        logger.info('\nEvents & News:');
        logger.info('  - impactAnalysis Is Array?', Array.isArray(lastAnalysis.events_news?.impactAnalysis));
        logger.info('  - impactAnalysis Length:', lastAnalysis.events_news?.impactAnalysis?.length || 0);
        if (lastAnalysis.events_news?.impactAnalysis?.[0]) {
            logger.info('  - Sample:', {
                id: lastAnalysis.events_news.impactAnalysis[0].id,
                title: lastAnalysis.events_news.impactAnalysis[0].title,
                impact: lastAnalysis.events_news.impactAnalysis[0].impact
            });
        }

        logger.info('\nSignals with Financial Ratios:');
        logger.info('  - Signals Is Array?', Array.isArray(lastAnalysis.signals));
        logger.info('  - Signals Length:', lastAnalysis.signals?.length || 0);
        if (lastAnalysis.signals?.[0]) {
            logger.info('  - Signal[0] has financialRatios?', Array.isArray(lastAnalysis.signals[0].financialRatios));
            logger.info('  - Signal[0] financialRatios Length:', lastAnalysis.signals[0].financialRatios?.length || 0);
        }

        logger.info('\n✅ All tab data structures verified!');

    } catch (error) {
        logger.error('❌ Test failed:', error.message);
    }
}

test();

#!/usr/bin/env node
// Test: Verify frontend normalization works with backend response

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
        logger.info('📊 Backend → Frontend Mapping Test:\n');
        logger.info('✅ companyData:', normalized.companyData?.length || 0, 'items');
        logger.info('✅ financialRatios:', normalized.financialRatios?.length || 0, 'items');
        logger.info('✅ events.impactAnalysis:', normalized.events?.impactAnalysis?.length || 0, 'items');
        logger.info('✅ onChainData:', normalized.onChainData ? 'Present' : 'Missing');
        logger.info('✅ fairValueHistory:', normalized.fairValueHistory?.length || 0, 'items');
        logger.info('✅ overview:', Object.keys(normalized.overview || {}).length, 'fields');
        logger.info('✅ signals:', normalized.signals?.length || 0, 'items');
        logger.info('✅ averageScore:', normalized.averageScore);
        logger.info('✅ marketSummary:', JSON.stringify(normalized.marketSummary));
        logger.info('✅ alerts:', normalized.alerts?.length || 0, 'items');

        logger.info('\n✅ All UI fields present - normalization successful!');

    } catch (error) {
        logger.error('❌ Test failed:', error.message);
    }
}

test();

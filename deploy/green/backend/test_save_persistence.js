#!/usr/bin/env node
// Test: Save and refetch config

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

        // 2. Get agent
        const agentsRes = await fetch(`${API_BASE}/ai-agents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { agents } = await agentsRes.json();
        const fund = agents.find(a => a.agent_key === 'fundamental');
        logger.info('✅ Found Fundamental Agent\n');

        // 3. Get current config
        const beforeRes = await fetch(`${API_BASE}/ai-agents/${fund.id}/details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const beforeData = await beforeRes.json();
        
        logger.info('📊 Config BEFORE save:');
        logger.info('  - shareWithArtemis:', beforeData.agent.config.integrationSettings?.shareWithArtemis);
        logger.info('  - syncWithPricePrediction:', beforeData.agent.config.integrationSettings?.syncWithPricePrediction);
        logger.info('  - dashboard alert:', beforeData.agent.config.alertChannels?.dashboard);
        logger.info('  - email alert:', beforeData.agent.config.alertChannels?.email);
        logger.info('');

        // 4. Change config
        const newConfig = {
            ...beforeData.agent.config,
            integrationSettings: {
                shareWithArtemis: false,  // ← Changed!
                syncWithPricePrediction: true,
                syncWithPortfolio: false,  // ← Changed!
                syncWithRisk: true,
                forwardToDashboard: false   // ← Changed!
            },
            alertChannels: {
                dashboard: false,  // ← Changed!
                email: true,       // ← Changed!
                telegram: false,
                discord: false
            }
        };

        logger.info('💾 Saving NEW config...');
        logger.info('  - shareWithArtemis: false (changed)');
        logger.info('  - syncWithPortfolio: false (changed)');
        logger.info('  - forwardToDashboard: false (changed)');
        logger.info('  - dashboard: false (changed)');
        logger.info('  - email: true (changed)');
        logger.info('');

        // 5. Save
        const saveRes = await fetch(`${API_BASE}/ai-agents/${fund.id}/config`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ config: newConfig })
        });

        if (!saveRes.ok) {
            const err = await saveRes.text();
            throw new Error(`Save failed: ${err}`);
        }

        logger.info('✅ Save successful\n');

        // 6. Refetch
        const afterRes = await fetch(`${API_BASE}/ai-agents/${fund.id}/details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const afterData = await afterRes.json();

        logger.info('📊 Config AFTER refetch:');
        logger.info('  - shareWithArtemis:', afterData.agent.config.integrationSettings?.shareWithArtemis);
        logger.info('  - syncWithPortfolio:', afterData.agent.config.integrationSettings?.syncWithPortfolio);
        logger.info('  - forwardToDashboard:', afterData.agent.config.integrationSettings?.forwardToDashboard);
        logger.info('  - dashboard alert:', afterData.agent.config.alertChannels?.dashboard);
        logger.info('  - email alert:', afterData.agent.config.alertChannels?.email);
        logger.info('');

        // 7. Verify
        const passed = 
            afterData.agent.config.integrationSettings?.shareWithArtemis === false &&
            afterData.agent.config.integrationSettings?.syncWithPortfolio === false &&
            afterData.agent.config.integrationSettings?.forwardToDashboard === false &&
            afterData.agent.config.alertChannels?.dashboard === false &&
            afterData.agent.config.alertChannels?.email === true;

        if (passed) {
            logger.info('✅ ✅ ✅ TEST PASSED! Config persisted correctly!');
        } else {
            logger.info('❌ ❌ ❌ TEST FAILED! Config reset to defaults!');
            logger.info('\nExpected:');
            logger.info('  shareWithArtemis: false');
            logger.info('  syncWithPortfolio: false');
            logger.info('  forwardToDashboard: false');
            logger.info('  dashboard: false');
            logger.info('  email: true');
        }

    } catch (error) {
        logger.error('❌ Test failed:', error.message);
    }
}

test();

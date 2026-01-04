#!/usr/bin/env node
// Test: Save and refetch config

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

        // 2. Get agent
        const agentsRes = await fetch(`${API_BASE}/ai-agents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { agents } = await agentsRes.json();
        const fund = agents.find(a => a.agent_key === 'fundamental');
        console.log('✅ Found Fundamental Agent\n');

        // 3. Get current config
        const beforeRes = await fetch(`${API_BASE}/ai-agents/${fund.id}/details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const beforeData = await beforeRes.json();
        
        console.log('📊 Config BEFORE save:');
        console.log('  - shareWithArtemis:', beforeData.agent.config.integrationSettings?.shareWithArtemis);
        console.log('  - syncWithPricePrediction:', beforeData.agent.config.integrationSettings?.syncWithPricePrediction);
        console.log('  - dashboard alert:', beforeData.agent.config.alertChannels?.dashboard);
        console.log('  - email alert:', beforeData.agent.config.alertChannels?.email);
        console.log('');

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

        console.log('💾 Saving NEW config...');
        console.log('  - shareWithArtemis: false (changed)');
        console.log('  - syncWithPortfolio: false (changed)');
        console.log('  - forwardToDashboard: false (changed)');
        console.log('  - dashboard: false (changed)');
        console.log('  - email: true (changed)');
        console.log('');

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

        console.log('✅ Save successful\n');

        // 6. Refetch
        const afterRes = await fetch(`${API_BASE}/ai-agents/${fund.id}/details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const afterData = await afterRes.json();

        console.log('📊 Config AFTER refetch:');
        console.log('  - shareWithArtemis:', afterData.agent.config.integrationSettings?.shareWithArtemis);
        console.log('  - syncWithPortfolio:', afterData.agent.config.integrationSettings?.syncWithPortfolio);
        console.log('  - forwardToDashboard:', afterData.agent.config.integrationSettings?.forwardToDashboard);
        console.log('  - dashboard alert:', afterData.agent.config.alertChannels?.dashboard);
        console.log('  - email alert:', afterData.agent.config.alertChannels?.email);
        console.log('');

        // 7. Verify
        const passed = 
            afterData.agent.config.integrationSettings?.shareWithArtemis === false &&
            afterData.agent.config.integrationSettings?.syncWithPortfolio === false &&
            afterData.agent.config.integrationSettings?.forwardToDashboard === false &&
            afterData.agent.config.alertChannels?.dashboard === false &&
            afterData.agent.config.alertChannels?.email === true;

        if (passed) {
            console.log('✅ ✅ ✅ TEST PASSED! Config persisted correctly!');
        } else {
            console.log('❌ ❌ ❌ TEST FAILED! Config reset to defaults!');
            console.log('\nExpected:');
            console.log('  shareWithArtemis: false');
            console.log('  syncWithPortfolio: false');
            console.log('  forwardToDashboard: false');
            console.log('  dashboard: false');
            console.log('  email: true');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

test();

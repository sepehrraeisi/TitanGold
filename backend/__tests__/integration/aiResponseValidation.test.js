import request from 'supertest';
import app from '../../server.js';
import { query } from '../../database/db.js';
import jwt from 'jsonwebtoken';

describe('AI Response Validation Integration Tests', () => {
    let adminToken;
    let normalToken;
    let testAgentId;

    beforeAll(async () => {
        // Setup tokens
        adminToken = jwt.sign({ id: '00000000-0000-0000-0000-000000000001', role: 'admin' }, process.env.JWT_SECRET || 'test_secret');
        normalToken = jwt.sign({ id: '00000000-0000-0000-0000-000000000002', role: 'user' }, process.env.JWT_SECRET || 'test_secret');

        // Ensure test users exist in the database for foreign key constraints (request_logs)
        await query(`
            INSERT INTO users (id, email, username, password_hash, role)
            VALUES 
                ('00000000-0000-0000-0000-000000000001', 'admin@test.itangold', 'admin_test', 'hashed_pass', 'admin'),
                ('00000000-0000-0000-0000-000000000002', 'user@test.itangold', 'user_test', 'hashed_pass', 'user')
            ON CONFLICT (id) DO NOTHING
        `);

        // Ensure a test agent exists
        const res = await query(`
      INSERT INTO ai_agents (name, type, agent_key, status, is_enabled)
      VALUES ('Test Technical Agent', 'technical', 'technical', 'active', true)
      ON CONFLICT (agent_key) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
        testAgentId = res.rows[0].id;

        // Ensure artemis_state exists
        await query(`
      INSERT INTO artemis_state (status, mode, strategy)
      VALUES ('active', 'demo', 'mixture_of_experts')
      ON CONFLICT DO NOTHING
    `);
    });

    describe('AI Agents Endpoints', () => {
        it('GET /api/v1/ai-agents should return validated agent list', async () => {
            const response = await request(app)
                .get('/api/v1/ai-agents')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('agents');
            expect(Array.isArray(response.body.agents)).toBe(true);
            if (response.body.agents.length > 0) {
                const agent = response.body.agents[0];
                expect(agent).toHaveProperty('id');
                expect(agent).toHaveProperty('name');
                expect(agent).toHaveProperty('type');
            }
        });

        it('GET /api/v1/ai-agents/:id should return validated agent', async () => {
            const response = await request(app)
                .get(`/api/v1/ai-agents/${testAgentId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(testAgentId);
            expect(response.body).toHaveProperty('config');
        });

        it('POST /api/v1/ai-agents/:id/run should return validated analysis result', async () => {
            // Note: This might trigger a real/mock run. In test mode it should be safe.
            const response = await request(app)
                .post(`/api/v1/ai-agents/${testAgentId}/run`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    symbol: 'BTC/USDT',
                    timeframe: '1h'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('indicators');
            expect(Array.isArray(response.body.indicators)).toBe(true);
        });
    });

    describe('Artemis Endpoints', () => {
        it('GET /api/v1/artemis/health should return validated health status', async () => {
            const response = await request(app)
                .get('/api/v1/artemis/health')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('providers');
            expect(response.body).toHaveProperty('ready');
        });

        it('GET /api/v1/artemis/state should return validated orchestrator state', async () => {
            const response = await request(app)
                .get('/api/v1/artemis/state')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('orchestration');
        });
    });

    describe('Autopilot Endpoints', () => {
        it('GET /api/v1/autopilot/status should return validated status', async () => {
            const response = await request(app)
                .get('/api/v1/autopilot/status')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('enabled');
        });

        it('GET /api/v1/autopilot/suggestions should return validated list', async () => {
            const response = await request(app)
                .get('/api/v1/autopilot/suggestions')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('suggestions');
            expect(Array.isArray(response.body.suggestions)).toBe(true);
        });
    });
});

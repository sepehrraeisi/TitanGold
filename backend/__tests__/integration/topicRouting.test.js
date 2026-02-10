import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = `http://localhost:${process.env.PORT || 5002}/api/v1`;
let authToken = '';

describe('Topic Routing Integration Tests', () => {
    beforeAll(async () => {
        // Login to get auth token
        const res = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'admin@titangold.com',
            password: 'admin'
        });
        authToken = res.data.token;
    });

    describe('Topic Routing Rules CRUD', () => {
        let createdRuleId = null;

        it('should create a new routing rule', async () => {
            const ruleData = {
                name: 'Test Bitcoin Routing',
                keywords: ['bitcoin', 'btc', 'satoshi'],
                agent_key: 'market_intelligence',
                priority: 75
            };

            const res = await axios.post(`${BASE_URL}/topic-routing`, ruleData, {
                headers: { Authorization: `Bearer ${authToken}` }
            });

            expect(res.status).toBe(201);
            expect(res.data.rule).toBeDefined();
            expect(res.data.rule.name).toBe(ruleData.name);
            expect(res.data.rule.keywords).toEqual(ruleData.keywords);
            createdRuleId = res.data.rule.id;
        });

        it('should list all routing rules', async () => {
            const res = await axios.get(`${BASE_URL}/topic-routing`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });

            expect(res.status).toBe(200);
            expect(res.data.rules).toBeDefined();
            expect(Array.isArray(res.data.rules)).toBe(true);
            expect(res.data.rules.length).toBeGreaterThan(0);
        });

        it('should update a routing rule', async () => {
            const updates = {
                priority: 150,
                keywords: ['bitcoin', 'btc', 'satoshi', 'nakamoto']
            };

            const res = await axios.put(
                `${BASE_URL}/topic-routing/${createdRuleId}`,
                updates,
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            expect(res.status).toBe(200);
            expect(res.data.rule.priority).toBe(150);
            expect(res.data.rule.keywords).toEqual(updates.keywords);
        });

        it('should validate required fields on create', async () => {
            try {
                await axios.post(`${BASE_URL}/topic-routing`, {
                    name: 'Incomplete Rule'
                    // Missing keywords and agent_key
                }, {
                    headers: { Authorization: `Bearer ${authToken}` }
                });
                fail('Should have thrown validation error');
            } catch (error) {
                expect(error.response.status).toBe(400);
            }
        });

        it('should delete a routing rule', async () => {
            const res = await axios.delete(
                `${BASE_URL}/topic-routing/${createdRuleId}`,
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            expect(res.status).toBe(200);
        });

        it('should return 404 for non-existent rule', async () => {
            try {
                await axios.get(
                    `${BASE_URL}/topic-routing/00000000-0000-0000-0000-000000000000`,
                    { headers: { Authorization: `Bearer ${authToken}` } }
                );
                fail('Should have thrown 404');
            } catch (error) {
                expect(error.response.status).toBe(404);
            }
        });
    });

    describe('Topic Routing Logs', () => {
        it('should retrieve routing logs', async () => {
            const res = await axios.get(`${BASE_URL}/topic-routing/logs?limit=10`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });

            expect(res.status).toBe(200);
            expect(res.data.logs).toBeDefined();
            expect(Array.isArray(res.data.logs)).toBe(true);
            expect(res.data.total).toBeDefined();
            expect(res.data.limit).toBe(10);
        });

        it('should support pagination in logs', async () => {
            const res = await axios.get(
                `${BASE_URL}/topic-routing/logs?limit=5&offset=5`,
                { headers: { Authorization: `Bearer ${authToken}` } }
            );

            expect(res.status).toBe(200);
            expect(res.data.limit).toBe(5);
            expect(res.data.offset).toBe(5);
        });
    });

    describe('Authentication', () => {
        it('should require authentication for all endpoints', async () => {
            try {
                await axios.get(`${BASE_URL}/topic-routing`);
                fail('Should have required authentication');
            } catch (error) {
                expect(error.response.status).toBe(401);
            }
        });
    });
});

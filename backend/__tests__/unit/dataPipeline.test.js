/**
 * Unit Tests for Data Pipeline Service
 * Tests data processing flow: Normalization -> Validation -> Routing -> Queuing
 * 
 * @jest-environment node
 */

import { jest } from '@jest/globals';

// Mock dependencies
const mockQuery = jest.fn();
jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
    transaction: jest.fn()
}));

const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};
jest.unstable_mockModule('../../services/logger.js', () => ({
    logger: mockLogger
}));

const mockNormalizer = {
    normalize: jest.fn()
};
jest.unstable_mockModule('../../services/normalizers/dataNormalizer.js', () => ({
    dataNormalizer: mockNormalizer
}));

const mockValidator = {
    validate: jest.fn(),
    validateContract: jest.fn(),
};
jest.unstable_mockModule('../../services/validators/dataValidator.js', () => ({
    dataValidator: mockValidator
}));

const mockRouter = {
    route: jest.fn()
};
jest.unstable_mockModule('../../services/routers/dataRouter.js', () => ({
    dataRouter: mockRouter
}));

jest.unstable_mockModule('../../services/topicRouter.js', () => ({
    topicRouter: { route: jest.fn().mockResolvedValue([]) },
}));

// Import the module under test (after mocking)
const { dataPipeline } = await import('../../services/dataPipeline.js');

describe('Data Pipeline Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('processPendingData', () => {
        test('should do nothing if no pending data found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await dataPipeline.processPendingData();

            expect(mockQuery).toHaveBeenCalledTimes(1); // One for select
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringMatching(/processing.*pending items/));
        });

        test('should process pending items', async () => {
            const mockRows = [
                { id: 1, source_id: 'src-1', raw_data: {}, source_type: 'api', source_category: 'market' },
                { id: 2, source_id: 'src-2', raw_data: {}, source_type: 'rss', source_category: 'news' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: mockRows }); // Select

            // Mock updateCollectedStatus calls (one for each item in success path)
            // But processItem is complex, so we will mock the internals of processItem in the next tests.
            // Here we just want to verify the loop.

            // We can spy on processItem if we want, but since it's a class method we might need to prototype spy or just rely on mocked dependencies being called.
            // Let's rely on mocked dependencies.

            // Mock normalize, validate, route for item 1 and 2
            mockNormalizer.normalize.mockReturnValue({ normalized: true });
            mockValidator.validateContract.mockReturnValue({
                valid: true,
                errors: [],
                warnings: [],
                qualityHints: [],
            });
            mockRouter.route.mockReturnValue(['agent1']);

            // Mock DB updates (Update collected_data, Insert queue)
            mockQuery.mockResolvedValue({ rowCount: 1 });

            await dataPipeline.processPendingData();

            // 1 SELECT + (ACL check + UPDATE collected + INSERT queue) * 2 items = 7 queries
            expect(mockQuery).toHaveBeenCalledTimes(7);
        });
    });

    describe('processItem', () => {
        const mockRow = {
            id: 123,
            source_id: 'src-123',
            raw_data: { foo: 'bar' },
            source_type: 'api',
            source_category: 'market',
        };

        test('should successfully process valid item', async () => {
            const normalizedData = { foo: 'bar', normalized: true };
            mockNormalizer.normalize.mockReturnValue(normalizedData);
            mockValidator.validateContract.mockReturnValue({
                valid: true,
                errors: [],
                warnings: [],
                qualityHints: [],
            });
            mockRouter.route.mockReturnValue(['technical_agent', 'risk_agent']);
            mockQuery.mockImplementation(async (sql) => {
                const text = String(sql);
                if (text.includes('FROM source_access_controls')) {
                    return {
                        rows: [{
                            allowed_agents: ['technical_agent', 'risk_agent'],
                            blocked_agents: [],
                            allowed_data_types: [],
                            blocked_data_types: [],
                        }],
                    };
                }
                if (text.includes('INSERT INTO data_hub_logs')) {
                    return { rows: [{ id: 'log-1' }], rowCount: 1 };
                }
                return { rows: [], rowCount: 1 };
            });

            await dataPipeline.processItem(mockRow);

            // 1. Normalize called
            expect(mockNormalizer.normalize).toHaveBeenCalledWith(
                mockRow.raw_data,
                mockRow.source_type,
                expect.objectContaining({ sourceId: 'src-123', category: 'market' }),
            );

            // 2. Validate called
            expect(mockValidator.validateContract).toHaveBeenCalledWith(normalizedData);

            // 3. Status updated to processed
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE collected_data SET normalized_data/),
                [JSON.stringify(normalizedData), 'processed', 123]
            );

            // 4. Route called
            expect(mockRouter.route).toHaveBeenCalledWith(normalizedData, mockRow.source_category);

            // 5. Queue inserted (2 agents)
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringMatching(/INSERT INTO data_queue/),
                ['src-123', 123, 5, 'pending', 3],
            );
            // Actually let's check exact args. The code snippet showed: source_id, data_id
            // In mockRow I didn't verify source_id presence. Code says: `row.source_id, row.id`
            // Let's assume passed undefined is fine for the mock check, but better add it.
        });

        test('should mark as failed if validation fails', async () => {
            mockNormalizer.normalize.mockReturnValue({});
            mockValidator.validateContract.mockReturnValue({
                valid: false,
                errors: ['Validation failed'],
                warnings: [],
                qualityHints: [],
            });

            await dataPipeline.processItem(mockRow);

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE collected_data SET status/),
                ['error', 'Validation failed', 123],
            );

            // Should NOT route or queue
            expect(mockRouter.route).not.toHaveBeenCalled();
        });

        test('should mark as failed if exception thrown', async () => {
            mockNormalizer.normalize.mockImplementation(() => {
                throw new Error('Normalization boom');
            });

            await dataPipeline.processItem(mockRow);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringMatching(/Item processing failed/));
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE collected_data SET status/),
                ['error', 'Normalization boom', 123]
            );
        });
    });
});

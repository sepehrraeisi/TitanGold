/**
 * DH-DATA-ARCHIVING-P3 — fixture service unit tests.
 * @jest-environment node
 */
import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
    query: mockQuery,
    transaction: mockTransaction,
}));

jest.unstable_mockModule('../../services/datahubArchivingService.js', () => ({
    previewArchive: jest.fn(async () => ({ dry_run: true, pending_count: 5 })),
    previewRestore: jest.fn(async () => ({ dry_run: true, pending_count: 1 })),
    previewPurge: jest.fn(async () => ({
        dry_run: true,
        purge_apply_available: false,
        would_purge_count: 0,
    })),
}));

const fixture = await import('../../services/datahubArchivingFixtureService.js');

describe('datahubArchivingFixtureService P3', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockTransaction.mockReset();
    });

    it('verifyNoNonFixtureMovement passes when only fixture moves on archive', () => {
        const fixtureId = 'fixture-1';
        const result = fixture.verifyNoNonFixtureMovement({
            beforeActiveIds: ['a', 'b', fixtureId],
            afterActiveIds: ['a', 'b'],
            beforeArchivedIds: [],
            afterArchivedIds: [fixtureId],
            fixtureId,
            phase: 'archive',
        });
        expect(result.ok).toBe(true);
        expect(result.active_non_fixture_unchanged).toBe(true);
        expect(result.fixture_moved_correctly).toBe(true);
    });

    it('verifyNoNonFixtureMovement fails when non-fixture active row disappears', () => {
        const result = fixture.verifyNoNonFixtureMovement({
            beforeActiveIds: ['a', 'b', 'fixture-1'],
            afterActiveIds: ['a'],
            beforeArchivedIds: [],
            afterArchivedIds: ['fixture-1', 'b'],
            fixtureId: 'fixture-1',
            phase: 'archive',
        });
        expect(result.ok).toBe(false);
        expect(result.active_non_fixture_unchanged).toBe(false);
    });

    it('createFixture inserts marked test row', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'f1',
                    created_at: new Date('2026-02-01'),
                    metadata: { source: fixture.FIXTURE_SOURCE },
                }],
            });
        const row = await fixture.createFixture({ testRunId: 'run-1' });
        expect(row.test_run_id).toBe('run-1');
        expect(mockQuery.mock.calls[0][0]).toMatch(/INSERT INTO ai_decisions/);
        expect(mockQuery.mock.calls[0][1][2]).toBe(fixture.FIXTURE_DECISION_TYPE);
    });

    it('previewArchiveFixture requires fixture in candidate set', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [{ id: 'f1', created_at: new Date(), metadata: {} }],
            })
            .mockResolvedValueOnce({ rows: [{ id: 'f1' }] })
            .mockResolvedValueOnce({ rows: [] });
        const preview = await fixture.previewArchiveFixture({
            fixtureId: 'f1',
            testRunId: 'run-1',
        });
        expect(preview.fixture_in_preview).toBe(true);
        expect(preview.fixture_already_archived).toBe(false);
    });

    it('assertPurgeCountOnly confirms no row count change', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [{ active_count: 12, archived_count: 0 }],
            })
            .mockResolvedValueOnce({
                rows: [{ active_count: 12, archived_count: 0 }],
            });
        const result = await fixture.assertPurgeCountOnly();
        expect(result.purge_apply_available).toBe(false);
        expect(result.active_count_unchanged).toBe(true);
    });
});

describe('P3 fixture verify script safety contract', () => {
    it('does not expose fixture helpers on public routes', async () => {
        const src = await import('fs').then(fs =>
            fs.promises.readFile(
                new URL('../../routes/data-hub-archiving.js', import.meta.url),
                'utf8',
            ),
        );
        expect(src).not.toMatch(/datahubArchivingFixtureService/);
        expect(src).not.toMatch(/archiveFixtureById/);
    });

    it('fixture verify script uses scoped archive not broad API', async () => {
        const src = await import('fs').then(fs =>
            fs.promises.readFile(
                new URL('../../scripts/archiving-p3-fixture-verify.mjs', import.meta.url),
                'utf8',
            ),
        );
        expect(src).toMatch(/archiveFixtureById/);
        expect(src).toMatch(/broad_archive_used: false/);
        expect(src).not.toMatch(/executeArchive\(\{[^}]*confirmArchive: true/);
    });
});

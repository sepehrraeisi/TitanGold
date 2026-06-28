#!/usr/bin/env node
/**
 * DH-DATA-ARCHIVING-P3 — safe fixture archive + restore verification.
 * Run: cd backend && node scripts/archiving-p3-fixture-verify.mjs
 */
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/ssot_v3/screenshots/archiving-p3-fixture-evidence.json');
const ADMIN_ID = process.env.ARCHIVING_P3_USER_ID || 'e134c7b1-b183-4e21-9acf-e3d53b9806d6';

const {
    FIXTURE_SOURCE,
    FIXTURE_CREATED_BY,
    DEFAULT_ARCHIVE_THRESHOLD_DAYS,
    cleanupFixtures,
    createFixture,
    getArchivingCounts,
    isAdvisoryLockFree,
    previewArchiveFixture,
    archiveFixtureById,
    previewRestoreFixture,
    restoreFixtureById,
    assertFixturePayloadMatch,
    getFixtureArchivePartition,
    assertPurgeCountOnly,
} = await import('../services/datahubArchivingFixtureService.js');

const { executeArchive, executeRestore } = await import('../services/datahubArchivingService.js');
const { query } = await import('../database/db.js');

function fail(step, message, evidence) {
    evidence.failed_step = step;
    evidence.error = message;
    evidence.success = false;
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2));
    console.error(`P3 FIXTURE VERIFY FAILED at ${step}: ${message}`);
    console.log(JSON.stringify(evidence, null, 2));
    process.exit(1);
}

function assertStep(evidence, step, condition, message) {
    if (!condition) fail(step, message, evidence);
    evidence.steps.push({ step, ok: true, message: message || step });
}

async function main() {
    const t0 = Date.now();
    const testRunId = randomUUID();
    const evidence = {
        capturedAt: new Date().toISOString(),
        test_run_id: testRunId,
        fixture_source: FIXTURE_SOURCE,
        fixture_created_by: FIXTURE_CREATED_BY,
        success: false,
        steps: [],
        preflight: {},
        counts: {},
        fixture: null,
        archive_dry_run: null,
        archive_apply: null,
        restore_dry_run: null,
        restore_apply: null,
        cleanup: null,
        purge_check: null,
        confirm_gates: {},
        performance_ms: {},
        proof: {
            purge_executed: false,
            broad_archive_used: false,
            non_fixture_rows_moved: false,
        },
    };

    // Phase 1 — Pre-flight
    const migrations = await query(
        `SELECT name FROM pgmigrations WHERE name LIKE '%043%' OR name LIKE '%archiving%' ORDER BY name`,
    );
    evidence.preflight.migrations = migrations.rows.map(r => r.name);
    assertStep(
        evidence,
        'preflight_migration_043',
        evidence.preflight.migrations.some(n => n.includes('043')),
        'Migration 043 not applied',
    );

    evidence.preflight.advisory_lock_free = await isAdvisoryLockFree();
    assertStep(evidence, 'preflight_lock', evidence.preflight.advisory_lock_free, 'Advisory lock held');

    evidence.counts.before = await getArchivingCounts();
    evidence.preflight.baseline = { ...evidence.counts.before };

    const partitions = await query('SELECT * FROM list_archive_partitions()');
    evidence.preflight.partitions = partitions.rows;

    // Idempotent cleanup of stale fixtures
    evidence.cleanup_stale = await cleanupFixtures();

    try {
        await executeArchive({ daysOld: 90, dryRun: false, confirmArchive: undefined });
        fail('confirm_gate_archive', 'executeArchive should require confirm', evidence);
    } catch (e) {
        evidence.confirm_gates.archive_requires_confirm = e.code === 'CONFIRM_ARCHIVE_REQUIRED';
    }
    try {
        await executeRestore({
            startDate: '2024-01-01T00:00:00.000Z',
            endDate: '2024-02-01T00:00:00.000Z',
            dryRun: false,
            confirmRestore: undefined,
        });
        fail('confirm_gate_restore', 'executeRestore should require confirm', evidence);
    } catch (e) {
        evidence.confirm_gates.restore_requires_confirm = e.code === 'CONFIRM_RESTORE_REQUIRED';
    }

    evidence.purge_check = await assertPurgeCountOnly(ADMIN_ID);
    assertStep(
        evidence,
        'purge_count_only',
        evidence.purge_check.purge_apply_available === false &&
            evidence.purge_check.archived_count_unchanged &&
            evidence.purge_check.active_count_unchanged,
        'Purge is not count-only or changed row counts',
    );

    // Phase 2 — Create fixture
    const fixture = await createFixture({ testRunId, userId: ADMIN_ID });
    evidence.fixture = fixture;
    evidence.counts.after_insert = await getArchivingCounts();
    assertStep(
        evidence,
        'fixture_insert',
        evidence.counts.after_insert.active_count === evidence.counts.before.active_count + 1 &&
            evidence.counts.after_insert.pending_archive_count ===
                evidence.counts.before.pending_archive_count + 1,
        'Fixture insert did not increment counts as expected',
    );

    // Phase 3 — Dry-run archive
    evidence.archive_dry_run = await previewArchiveFixture({
        fixtureId: fixture.fixture_id,
        testRunId,
        daysOld: DEFAULT_ARCHIVE_THRESHOLD_DAYS,
        userId: ADMIN_ID,
    });
    assertStep(
        evidence,
        'archive_dry_run',
        evidence.archive_dry_run.fixture_in_preview &&
            !evidence.archive_dry_run.fixture_already_archived,
        'Archive preview does not include fixture',
    );

    const inArchiveBeforeApply = await query(
        `SELECT id FROM ai_decisions_archive WHERE id = $1`,
        [fixture.fixture_id],
    );
    assertStep(evidence, 'archive_not_applied_yet', inArchiveBeforeApply.rows.length === 0, 'Fixture already archived before apply');

    // Phase 4 — Apply archive (fixture only)
    evidence.archive_apply = await archiveFixtureById({
        fixtureId: fixture.fixture_id,
        testRunId,
        userId: ADMIN_ID,
        daysOld: DEFAULT_ARCHIVE_THRESHOLD_DAYS,
    });
    evidence.counts.after_archive = await getArchivingCounts();
    evidence.archive_apply.partition = await getFixtureArchivePartition(fixture.fixture_id, testRunId);

    assertStep(
        evidence,
        'archive_apply_movement',
        evidence.archive_apply.movement_check?.ok === true,
        'Non-fixture rows moved during archive apply',
    );
    assertStep(
        evidence,
        'archive_apply_counts',
        evidence.counts.after_archive.active_count === evidence.counts.before.active_count &&
            evidence.counts.after_archive.archived_count === evidence.counts.before.archived_count + 1,
        'Counts wrong after archive apply',
    );
    evidence.proof.non_fixture_rows_moved = !evidence.archive_apply.movement_check?.ok;

    // Phase 5 — Dry-run restore
    evidence.restore_dry_run = await previewRestoreFixture({
        fixtureId: fixture.fixture_id,
        testRunId,
        userId: ADMIN_ID,
    });
    assertStep(
        evidence,
        'restore_dry_run',
        evidence.restore_dry_run.fixture_in_preview &&
            evidence.restore_dry_run.fixture_in_archive_before_restore &&
            !evidence.restore_dry_run.fixture_in_active_before_restore,
        'Restore preview failed fixture checks',
    );

    // Phase 6 — Apply restore (fixture only)
    evidence.restore_apply = await restoreFixtureById({
        fixtureId: fixture.fixture_id,
        testRunId,
        userId: ADMIN_ID,
    });
    evidence.counts.after_restore = await getArchivingCounts();
    evidence.restore_apply.payload_match = await assertFixturePayloadMatch(
        fixture.fixture_id,
        testRunId,
        fixture,
    );

    assertStep(
        evidence,
        'restore_apply_movement',
        evidence.restore_apply.movement_check?.ok === true,
        'Non-fixture rows moved during restore apply',
    );
    assertStep(
        evidence,
        'restore_apply_payload',
        evidence.restore_apply.payload_match.input_matches &&
            evidence.restore_apply.payload_match.output_matches &&
            evidence.restore_apply.payload_match.metadata_matches,
        'Restored fixture payload mismatch',
    );
    assertStep(
        evidence,
        'restore_apply_counts',
        evidence.counts.after_restore.archived_count === evidence.counts.before.archived_count &&
            evidence.counts.after_restore.active_count === evidence.counts.before.active_count + 1,
        'Counts wrong after restore apply',
    );

    // Phase 7 — Cleanup
    evidence.cleanup = await cleanupFixtures({ testRunId });
    evidence.counts.final = await getArchivingCounts();
    assertStep(
        evidence,
        'cleanup',
        evidence.counts.final.active_count === evidence.counts.before.active_count &&
            evidence.counts.final.archived_count === evidence.counts.before.archived_count &&
            evidence.counts.final.pending_archive_count === evidence.counts.before.pending_archive_count &&
            evidence.counts.final.active_fixture_count === 0 &&
            evidence.counts.final.archived_fixture_count === 0,
        'Cleanup failed — counts not restored to baseline',
    );

    evidence.performance_ms.total = Date.now() - t0;
    evidence.success = true;
    evidence.verdict = 'REAL WORKING for fixture archive/restore apply paths';
    evidence.notes = [
        'Broad production archive not executed — fixture-only scoped helpers used',
        'Purge not executed — count-only preview verified',
        'Production non-fixture row IDs unchanged throughout test',
    ];

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
}

main().catch(err => {
    const evidence = {
        capturedAt: new Date().toISOString(),
        success: false,
        error: err.message,
        code: err.code || null,
        stack: err.stack,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2));
    console.error(err);
    process.exit(1);
});

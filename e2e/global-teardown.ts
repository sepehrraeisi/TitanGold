/**
 * Fail-safe cleanup for disposable Trend Staging fixtures.
 * If no promotion marker exists, cleanup is a safe no-op.
 * If a marker exists, all identity fields are mandatory and cleanup must succeed.
 */
import { cleanupPromotedFixture } from './fixtureProcess.mjs';

export default async function globalTeardown() {
  if (process.env.RUN_LOGIN_E2E !== '1') return;
  cleanupPromotedFixture({ env: process.env });
}

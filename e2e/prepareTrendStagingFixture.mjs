#!/usr/bin/env node
/**
 * Prepare disposable Staging E2E fixture with trader role for Trend analyze/settings tests.
 * Shell-free: delegates to fixtureProcess (execFileSync + argv array, shell:false).
 * Writes .e2e-playwright.env (gitignored) — never log passwords to stdout.
 */
import { prepareTrendStagingFixture } from './fixtureProcess.mjs';

prepareTrendStagingFixture();
console.log('E2E fixture prepared (trader role, analyze enabled)');

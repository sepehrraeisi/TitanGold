/**
 * Lightweight integration smoke tests.
 * Usage: BASE_URL=http://localhost:5001 node tests/integration.smoke.js
 */

const baseUrl = process.env.BASE_URL || 'http://localhost:5001';

async function checkHealth() {
  const res = await fetch(`${baseUrl}/health`);
  const body = await res.json().catch(() => ({}));
  console.log('Health:', res.status, body.status);
  if (res.status !== 200) throw new Error('Health check failed');
}

async function checkSwagger() {
  const res = await fetch(`${baseUrl}/api/docs.json`);
  console.log('Swagger docs:', res.status);
  if (res.status !== 200) throw new Error('Swagger docs not reachable');
}

async function checkExportsUnauthorized() {
  const res = await fetch(`${baseUrl}/api/exports/trades`);
  console.log('Exports (expected 401/200 depending on auth):', res.status);
  if (![200, 401].includes(res.status)) {
    throw new Error(`Unexpected status for exports: ${res.status}`);
  }
}

async function run() {
  try {
    console.log('Running integration smoke tests against', baseUrl);
    await checkHealth();
    await checkSwagger();
    await checkExportsUnauthorized();
    console.log('✅ Integration smoke tests passed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Integration tests failed:', err.message);
    process.exit(1);
  }
}

run();


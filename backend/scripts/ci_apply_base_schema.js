#!/usr/bin/env node
/**
 * CI-only: apply repository base schema.sql to a disposable DATABASE_URL.
 * Does not touch Staging/Production. Does not rewrite migration history files.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '../../database/schema.sql');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sql = readFileSync(schemaPath, 'utf8');
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(sql);
    console.log('✅ Base schema applied:', schemaPath);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ ci_apply_base_schema failed:', err.message);
  process.exit(1);
});

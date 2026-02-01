/**
 * One-time migration: Encrypt plaintext API keys
 * Run once to encrypt existing plaintext keys in database
 */

import { query } from '../database/db.js';
import { encryptSecret, isEncrypted } from './crypto.js';

async function migrateKeys() {
  console.log('🔐 Starting API key encryption migration...\n');
  
  try {
    // Fetch all integrations
    const result = await query('SELECT id, provider, name, api_key_encrypted FROM api_integrations');
    
    console.log(`Found ${result.rows.length} integrations\n`);
    
    let encrypted = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const integration of result.rows) {
      const { id, provider, name, api_key_encrypted } = integration;
      
      // Skip if already encrypted
      if (isEncrypted(api_key_encrypted)) {
        console.log(`⏭️  ${provider}/${name}: Already encrypted`);
        skipped++;
        continue;
      }
      
      // Skip if empty
      if (!api_key_encrypted) {
        console.log(`⏭️  ${provider}/${name}: No key to encrypt`);
        skipped++;
        continue;
      }
      
      try {
        // Encrypt
        const encrypted_key = encryptSecret(api_key_encrypted);
        
        // Update DB
        await query(
          'UPDATE api_integrations SET api_key_encrypted = $1, updated_at = NOW() WHERE id = $2',
          [encrypted_key, id]
        );
        
        console.log(`✅ ${provider}/${name}: Encrypted successfully`);
        encrypted++;
      } catch (error) {
        console.error(`❌ ${provider}/${name}: Encryption failed:`, error.message);
        failed++;
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   Encrypted: ${encrypted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Failed: ${failed}`);
    console.log(`\n${failed === 0 ? '✅' : '⚠️'} Migration ${failed === 0 ? 'completed successfully' : 'completed with errors'}`);
    
    process.exit(failed === 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateKeys();

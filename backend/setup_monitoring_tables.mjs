import { query } from './database/db.js';

async function setupMonitoringTables() {
  console.log('📊 Setting up monitoring tables...\n');

  try {
    // 1. Create request_logs table
    console.log('1️⃣ Creating request_logs table...');
    await query(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ request_logs table created');

    // 2. Create indexes for request_logs
    console.log('\n2️⃣ Creating indexes for request_logs...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_request_logs_created_at 
      ON request_logs(created_at DESC)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_request_logs_status 
      ON request_logs(status)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_request_logs_path 
      ON request_logs(path)
    `);
    console.log('✅ request_logs indexes created');

    // 3. Create error_logs table
    console.log('\n3️⃣ Creating error_logs table...');
    await query(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        context TEXT NOT NULL,
        message TEXT NOT NULL,
        stack TEXT,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ error_logs table created');

    // 4. Create index for error_logs
    console.log('\n4️⃣ Creating index for error_logs...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_error_logs_created_at 
      ON error_logs(created_at DESC)
    `);
    console.log('✅ error_logs index created');

    // 5. Verify tables
    console.log('\n5️⃣ Verifying tables...');
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('request_logs', 'error_logs')
      ORDER BY table_name
    `);
    console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));

    // 6. Seed a few test logs
    console.log('\n6️⃣ Seeding test logs...');
    
    // Test request logs
    for (let i = 0; i < 10; i++) {
      await query(`
        INSERT INTO request_logs (method, path, status, duration_ms)
        VALUES ($1, $2, $3, $4)
      `, [
        ['GET', 'POST', 'PUT'][i % 3],
        ['/api/config/artemis', '/api/config/security', '/api/auth/login'][i % 3],
        [200, 200, 200, 400, 500][i % 5],
        Math.floor(Math.random() * 500) + 50
      ]);
    }
    
    // Test error logs
    await query(`
      INSERT INTO error_logs (context, message, stack, meta)
      VALUES 
        ('auth', 'Invalid credentials', 'Error: Invalid credentials\n  at login...', '{"ip":"127.0.0.1"}'),
        ('database', 'Connection timeout', 'Error: ETIMEDOUT\n  at Pool.connect...', '{"host":"localhost"}'),
        ('api', 'Rate limit exceeded', 'Error: 429 Too Many Requests', '{"endpoint":"/api/artemis/decision"}')
    `);
    
    console.log('✅ Test logs seeded');

    console.log('\n✅ Monitoring tables setup complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error setting up monitoring tables:', error);
    process.exit(1);
  }
}

setupMonitoringTables();

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'titan_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function checkUsersTable() {
  try {
    console.log('\n📊 Checking users table structure...\n');
    
    // Get table columns
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('Columns in users table:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    columns.rows.forEach(col => {
      console.log(`${col.column_name.padEnd(20)} ${col.data_type.padEnd(20)} ${col.is_nullable}`);
    });
    
    // Get sample user
    console.log('\n📋 Sample user data:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const sampleUser = await pool.query('SELECT * FROM users LIMIT 1');
    if (sampleUser.rows.length > 0) {
      console.log('Columns:', Object.keys(sampleUser.rows[0]).join(', '));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsersTable();

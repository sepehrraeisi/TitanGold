import pg from 'pg';
import dotenv from 'dotenv';
import { logger } from './services/logger.js';

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
    logger.info('\n📊 Checking users table structure...\n');
    
    // Get table columns
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    logger.info('Columns in users table:');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    columns.rows.forEach(col => {
      logger.info(`${col.column_name.padEnd(20)} ${col.data_type.padEnd(20)} ${col.is_nullable}`);
    });
    
    // Get sample user
    logger.info('\n📋 Sample user data:');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const sampleUser = await pool.query('SELECT * FROM users LIMIT 1');
    if (sampleUser.rows.length > 0) {
      logger.info('Columns:', Object.keys(sampleUser.rows[0]).join(', '));
    }
    
  } catch (error) {
    logger.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsersTable();

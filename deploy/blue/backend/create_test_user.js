import pg from 'pg';
import bcrypt from 'bcrypt';
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

async function createTestUser() {
  try {
    const username = 'testuser';
    const email = 'test@titan.local';
    const password = 'Test@123456';
    
    logger.info('\n🔐 Creating test user...');
    logger.info('Username:', username);
    logger.info('Email:', email);
    logger.info('Password:', password);
    logger.info('\n📊 DB Config:');
    logger.info('Host:', process.env.DB_HOST);
    logger.info('Port:', process.env.DB_PORT);
    logger.info('Database:', process.env.DB_NAME);
    logger.info('User:', process.env.DB_USER);
    
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      logger.info('\n✅ User already exists!');
      logger.info('User ID:', existingUser.rows[0].id);
      logger.info('\n📝 Login Credentials:');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('🌐 URL: https://titan.zala.ir');
      logger.info('👤 Username:', username);
      logger.info('📧 Email:', email);
      logger.info('🔑 Password:', password);
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      process.exit(0);
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, email, password, is_active, created_at)
       VALUES ($1, $2, $3, true, NOW())
       RETURNING id, username, email`,
      [username, email, hashedPassword]
    );
    
    logger.info('\n✅ Test user created successfully!');
    logger.info('User ID:', result.rows[0].id);
    
    logger.info('\n📝 Login Credentials:');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('🌐 URL: https://titan.zala.ir');
    logger.info('👤 Username:', username);
    logger.info('📧 Email:', email);
    logger.info('🔑 Password:', password);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    logger.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      logger.error('\n💡 Solution: Database is not running or connection refused');
      logger.error('Try: sudo systemctl start postgresql@15-main');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createTestUser();

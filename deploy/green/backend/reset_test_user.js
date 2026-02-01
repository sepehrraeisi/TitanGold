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

async function resetTestUser() {
  try {
    const username = 'testuser';
    const email = 'test@titan.local';
    const newPassword = 'Test@123456';
    
    logger.info('\n🔐 Resetting test user password...');
    
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length === 0) {
      logger.info('❌ User not found!');
      logger.info('Creating new user...');
      
      // Hash password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Create user
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, is_active, is_verified, role, created_at)
         VALUES ($1, $2, $3, true, true, 'user', NOW())
         RETURNING id, username, email`,
        [username, email, hashedPassword]
      );
      
      logger.info('✅ Test user created!');
      logger.info('User ID:', result.rows[0].id);
    } else {
      logger.info('✅ User found!');
      logger.info('User ID:', existingUser.rows[0].id);
      logger.info('Username:', existingUser.rows[0].username);
      logger.info('Email:', existingUser.rows[0].email);
      logger.info('Created:', existingUser.rows[0].created_at);
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, existingUser.rows[0].id]
      );
      
      logger.info('✅ Password updated successfully!');
    }
    
    logger.info('\n📝 Login Credentials:');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('🌐 URL: https://titan.zala.ir');
    logger.info('👤 Username:', username);
    logger.info('📧 Email:', email);
    logger.info('🔑 Password:', newPassword);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Test the password
    logger.info('🔬 Testing password hash...');
    const testUser = await pool.query(
      'SELECT password_hash FROM users WHERE username = $1',
      [username]
    );
    
    const isValid = await bcrypt.compare(newPassword, testUser.rows[0].password_hash);
    logger.info('Password validation:', isValid ? '✅ VALID' : '❌ INVALID');
    
    if (isValid) {
      logger.info('\n✅ Ready to login!');
    } else {
      logger.info('\n❌ Password hash mismatch! Please check bcrypt configuration.');
    }
    
  } catch (error) {
    logger.error('❌ Error:', error.message);
    logger.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetTestUser();

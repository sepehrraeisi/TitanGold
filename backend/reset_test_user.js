import pg from 'pg';
import bcrypt from 'bcrypt';
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

async function resetTestUser() {
  try {
    const username = 'testuser';
    const email = 'test@titan.local';
    const newPassword = 'Test@123456';
    
    console.log('\n🔐 Resetting test user password...');
    
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length === 0) {
      console.log('❌ User not found!');
      console.log('Creating new user...');
      
      // Hash password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Create user
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, is_active, is_verified, role, created_at)
         VALUES ($1, $2, $3, true, true, 'user', NOW())
         RETURNING id, username, email`,
        [username, email, hashedPassword]
      );
      
      console.log('✅ Test user created!');
      console.log('User ID:', result.rows[0].id);
    } else {
      console.log('✅ User found!');
      console.log('User ID:', existingUser.rows[0].id);
      console.log('Username:', existingUser.rows[0].username);
      console.log('Email:', existingUser.rows[0].email);
      console.log('Created:', existingUser.rows[0].created_at);
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, existingUser.rows[0].id]
      );
      
      console.log('✅ Password updated successfully!');
    }
    
    console.log('\n📝 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 URL: https://titan.zala.ir');
    console.log('👤 Username:', username);
    console.log('📧 Email:', email);
    console.log('🔑 Password:', newPassword);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Test the password
    console.log('🔬 Testing password hash...');
    const testUser = await pool.query(
      'SELECT password_hash FROM users WHERE username = $1',
      [username]
    );
    
    const isValid = await bcrypt.compare(newPassword, testUser.rows[0].password_hash);
    console.log('Password validation:', isValid ? '✅ VALID' : '❌ INVALID');
    
    if (isValid) {
      console.log('\n✅ Ready to login!');
    } else {
      console.log('\n❌ Password hash mismatch! Please check bcrypt configuration.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetTestUser();

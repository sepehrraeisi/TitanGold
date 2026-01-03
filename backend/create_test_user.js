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

async function createTestUser() {
  try {
    const username = 'testuser';
    const email = 'test@titan.local';
    const password = 'Test@123456';
    
    console.log('\n🔐 Creating test user...');
    console.log('Username:', username);
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('\n📊 DB Config:');
    console.log('Host:', process.env.DB_HOST);
    console.log('Port:', process.env.DB_PORT);
    console.log('Database:', process.env.DB_NAME);
    console.log('User:', process.env.DB_USER);
    
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('\n✅ User already exists!');
      console.log('User ID:', existingUser.rows[0].id);
      console.log('\n📝 Login Credentials:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🌐 URL: https://titan.zala.ir');
      console.log('👤 Username:', username);
      console.log('📧 Email:', email);
      console.log('🔑 Password:', password);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
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
    
    console.log('\n✅ Test user created successfully!');
    console.log('User ID:', result.rows[0].id);
    
    console.log('\n📝 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 URL: https://titan.zala.ir');
    console.log('👤 Username:', username);
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Solution: Database is not running or connection refused');
      console.error('Try: sudo systemctl start postgresql@15-main');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createTestUser();

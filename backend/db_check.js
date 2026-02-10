import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'titangold_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function checkTables() {
    try {
        const res = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        console.log('Tables found:', res.rows.map(r => r.tablename));
        process.exit(0);
    } catch (err) {
        console.error('Database connection error:', err);
        process.exit(1);
    }
}

checkTables();

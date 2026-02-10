/**
 * Database Session Manager for Telegram Collector
 * Reads/writes encrypted sessions from PostgreSQL
 */

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    database: process.env.DB_NAME || 'titangold_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
});

/**
 * Get session from database
 */
export async function getSessionFromDB(serviceName = 'telegram-collector') {
    try {
        const result = await pool.query(
            `SELECT session_string, phone_number, api_id, api_hash, is_active, 
                    last_used_at, created_at, service_name
             FROM telegram_sessions
             WHERE service_name = $1 AND is_active = true
             ORDER BY created_at DESC
             LIMIT 1`,
            [serviceName]
        );

        if (result.rows.length === 0) {
            console.log('ℹ️  No session found in database for:', serviceName);
            return null;
        }

        const session = result.rows[0];
        
        // Update last_used_at
        await pool.query(
            'UPDATE telegram_sessions SET last_used_at = NOW() WHERE service_name = $1',
            [serviceName]
        );

        console.log('✅ Session loaded from database:', serviceName);
        return {
            serviceName: session.service_name,
            sessionString: session.session_string,
            phoneNumber: session.phone_number,
            apiId: session.api_id,
            apiHash: session.api_hash,
            isActive: session.is_active,
            lastUsedAt: session.last_used_at,
            createdAt: session.created_at
        };
    } catch (error) {
        console.error('❌ Failed to load session from database:', error.message);
        return null;
    }
}

/**
 * Save session to database
 */
export async function saveSessionToDB(
    serviceName: string = 'telegram-collector', 
    sessionString: string,
    phoneNumber?: string,
    apiId?: string,
    apiHash?: string
) {
    try {
        const result = await pool.query(
            `INSERT INTO telegram_sessions 
             (service_name, session_string, phone_number, api_id, api_hash)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (service_name) 
             DO UPDATE SET 
                session_string = EXCLUDED.session_string,
                phone_number = EXCLUDED.phone_number,
                api_id = EXCLUDED.api_id,
                api_hash = EXCLUDED.api_hash,
                updated_at = NOW(),
                last_used_at = NOW()
             RETURNING id`,
            [
                serviceName,
                sessionString,
                phoneNumber || null,
                apiId || process.env.TELEGRAM_API_ID,
                apiHash || process.env.TELEGRAM_API_HASH
            ]
        );

        console.log('✅ Session saved to database:', result.rows[0].id);
        return result.rows[0].id;
    } catch (error) {
        console.error('❌ Failed to save session to database:', error.message);
        throw error;
    }
}

/**
 * Delete session from database
 */
export async function deleteSessionFromDB(serviceName = 'telegram-collector') {
    try {
        await pool.query(
            'UPDATE telegram_sessions SET is_active = false, updated_at = NOW() WHERE service_name = $1',
            [serviceName]
        );
        console.log('✅ Session deactivated in database:', serviceName);
    } catch (error) {
        console.error('❌ Failed to deactivate session:', error.message);
    }
}

/**
 * Get session statistics
 */
export async function getSessionStats(serviceName = 'telegram-collector') {
    try {
        const result = await pool.query(`
            SELECT 
                is_active,
                last_used_at,
                created_at,
                phone_number
            FROM telegram_sessions
            WHERE service_name = $1
            ORDER BY created_at DESC
            LIMIT 1
        `, [serviceName]);

        if (result.rows.length === 0) {
            return {
                inDatabase: false,
                lastUsed: null,
                createdAt: null,
                phoneNumber: null
            };
        }

        const session = result.rows[0];
        return {
            inDatabase: true,
            lastUsed: session.last_used_at,
            createdAt: session.created_at,
            phoneNumber: session.phone_number,
            isActive: session.is_active
        };
    } catch (error) {
        console.error('❌ Failed to get session stats:', error.message);
        return {
            inDatabase: false,
            lastUsed: null,
            createdAt: null,
            phoneNumber: null
        };
    }
}

export default {
    getSessionFromDB,
    saveSessionToDB,
    deleteSessionFromDB,
    getSessionStats
};

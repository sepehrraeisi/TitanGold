/**
 * Session Rotation Service
 * Automatically rotates Telegram sessions every 30 days
 * Includes health checks and notifications
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import { 
    getSessionFromDB, 
    saveSessionToDB, 
    deleteSessionFromDB,
    getSessionStats 
} from '../utils/sessionManager.js';
import { decryptSecret } from '../../../backend/utils/crypto.js';

const ROTATION_INTERVAL_DAYS = 30;
const ROTATION_WARNING_DAYS = 25; // Warn 5 days before rotation
const HEALTH_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SessionHealth {
    isHealthy: boolean;
    lastChecked: Date;
    needsRotation: boolean;
    daysUntilRotation: number;
    sessionAge: number;
    errors: string[];
}

interface RotationResult {
    success: boolean;
    oldSessionId?: string;
    newSessionId?: string;
    rotatedAt: Date;
    error?: string;
    fallbackUsed: boolean;
}

class SessionRotationService {
    private healthCheckTimer?: NodeJS.Timeout;
    private lastHealthCheck?: Date;
    private sessionHealth: SessionHealth = {
        isHealthy: true,
        lastChecked: new Date(),
        needsRotation: false,
        daysUntilRotation: ROTATION_INTERVAL_DAYS,
        sessionAge: 0,
        errors: []
    };

    /**
     * Initialize the rotation service
     */
    async initialize() {
        console.log('🔄 Session Rotation Service initializing...');
        
        // Check session health immediately
        await this.checkSessionHealth();
        
        // Schedule periodic health checks
        this.scheduleHealthChecks();
        
        console.log('✅ Session Rotation Service initialized');
        console.log(`   - Rotation interval: ${ROTATION_INTERVAL_DAYS} days`);
        console.log(`   - Warning threshold: ${ROTATION_WARNING_DAYS} days`);
        console.log(`   - Health check interval: ${HEALTH_CHECK_INTERVAL_MS / 1000 / 60 / 60} hours`);
    }

    /**
     * Schedule periodic health checks
     */
    private scheduleHealthChecks() {
        this.healthCheckTimer = setInterval(async () => {
            console.log('🏥 Running scheduled session health check...');
            await this.checkSessionHealth();
        }, HEALTH_CHECK_INTERVAL_MS);
    }

    /**
     * Check session health and determine if rotation is needed
     */
    async checkSessionHealth(): Promise<SessionHealth> {
        console.log('🏥 Checking session health...');
        
        const errors: string[] = [];
        let isHealthy = true;
        let needsRotation = false;
        let daysUntilRotation = ROTATION_INTERVAL_DAYS;
        let sessionAge = 0;

        try {
            // Get session stats from database
            const stats = await getSessionStats('telegram-collector');
            
            if (!stats.inDatabase) {
                errors.push('No session found in database');
                isHealthy = false;
            } else if (!stats.isActive) {
                errors.push('Session is not active');
                isHealthy = false;
            } else if (stats.createdAt) {
                // Calculate session age
                const createdAt = new Date(stats.createdAt);
                const now = new Date();
                const ageMs = now.getTime() - createdAt.getTime();
                sessionAge = Math.floor(ageMs / (1000 * 60 * 60 * 24));
                daysUntilRotation = ROTATION_INTERVAL_DAYS - sessionAge;

                console.log(`   Session age: ${sessionAge} days`);
                console.log(`   Days until rotation: ${daysUntilRotation}`);

                // Check if rotation is needed
                if (sessionAge >= ROTATION_INTERVAL_DAYS) {
                    needsRotation = true;
                    errors.push(`Session is ${sessionAge} days old - rotation required`);
                    isHealthy = false;
                } else if (sessionAge >= ROTATION_WARNING_DAYS) {
                    console.log(`⚠️  Session will need rotation in ${daysUntilRotation} days`);
                }

                // Test connection if session is active
                if (isHealthy) {
                    try {
                        await this.testConnection();
                        console.log('✅ Session connection test passed');
                    } catch (error: any) {
                        errors.push(`Connection test failed: ${error.message}`);
                        isHealthy = false;
                        needsRotation = true;
                    }
                }
            }
        } catch (error: any) {
            errors.push(`Health check error: ${error.message}`);
            isHealthy = false;
        }

        this.sessionHealth = {
            isHealthy,
            lastChecked: new Date(),
            needsRotation,
            daysUntilRotation,
            sessionAge,
            errors
        };

        this.lastHealthCheck = new Date();

        // Log health status
        if (isHealthy) {
            console.log('✅ Session is healthy');
        } else {
            console.log('❌ Session health issues detected:');
            errors.forEach(err => console.log(`   - ${err}`));
        }

        // Trigger rotation if needed
        if (needsRotation) {
            console.log('🔄 Session rotation required - initiating...');
            await this.rotateSession();
        }

        return this.sessionHealth;
    }

    /**
     * Test connection to Telegram
     */
    private async testConnection(): Promise<void> {
        const session = await getSessionFromDB('telegram-collector');
        
        if (!session) {
            throw new Error('No session found for connection test');
        }

        const apiId = parseInt(process.env.TELEGRAM_API_ID || '');
        const apiHash = process.env.TELEGRAM_API_HASH || '';

        if (!apiId || !apiHash) {
            throw new Error('Missing TELEGRAM_API_ID or TELEGRAM_API_HASH');
        }

        // Decrypt session string
        let decryptedSessionString: string;
        try {
            decryptedSessionString = decryptSecret(session.sessionString);
        } catch (error) {
            // If decryption fails, assume it's already decrypted
            decryptedSessionString = session.sessionString;
        }

        const stringSession = new StringSession(decryptedSessionString);
        const client = new TelegramClient(stringSession, apiId, apiHash, {
            connectionRetries: 2,
            timeout: 10000
        });

        try {
            await client.connect();
            
            // Try to get current user
            const me = await client.getMe();
            if (!me) {
                throw new Error('Failed to get current user');
            }
            
            await client.disconnect();
        } catch (error) {
            await client.disconnect();
            throw error;
        }
    }

    /**
     * Rotate session
     */
    async rotateSession(): Promise<RotationResult> {
        console.log('🔄 Starting session rotation...');
        
        const result: RotationResult = {
            success: false,
            rotatedAt: new Date(),
            fallbackUsed: false
        };

        try {
            // Step 1: Get current session
            const currentSession = await getSessionFromDB('telegram-collector');
            
            if (!currentSession) {
                throw new Error('No current session found');
            }

            result.oldSessionId = currentSession.serviceName;

            // Step 2: Test current session before rotation
            console.log('   Testing current session...');
            try {
                await this.testConnection();
                console.log('   ✅ Current session is valid');
            } catch (error: any) {
                console.log(`   ⚠️  Current session test failed: ${error.message}`);
                console.log('   Proceeding with rotation anyway...');
            }

            // Step 3: Create new session
            console.log('   Creating new session...');
            const apiId = parseInt(process.env.TELEGRAM_API_ID || '');
            const apiHash = process.env.TELEGRAM_API_HASH || '';

            if (!apiId || !apiHash) {
                throw new Error('Missing TELEGRAM_API_ID or TELEGRAM_API_HASH');
            }

            // Decrypt session string
            let decryptedSessionString: string;
            try {
                decryptedSessionString = decryptSecret(currentSession.sessionString);
            } catch (error) {
                // If decryption fails, assume it's already decrypted
                decryptedSessionString = currentSession.sessionString;
            }

            const stringSession = new StringSession(decryptedSessionString);
            const client = new TelegramClient(stringSession, apiId, apiHash, {
                connectionRetries: 3
            });

            await client.connect();
            
            // Get fresh session string
            const newSessionString = client.session.save() as unknown as string;
            
            // Verify new session works
            const me = await client.getMe();
            if (!me) {
                throw new Error('Failed to verify new session');
            }

            await client.disconnect();

            // Step 4: Deactivate old session
            console.log('   Deactivating old session...');
            await deleteSessionFromDB('telegram-collector');

            // Step 5: Save new session
            console.log('   Saving new session...');
            const newSessionId = await saveSessionToDB(
                'telegram-collector',
                newSessionString,
                currentSession.phoneNumber,
                apiId.toString(),
                apiHash
            );

            result.success = true;
            result.newSessionId = newSessionId.toString();
            
            console.log('✅ Session rotation completed successfully');
            console.log(`   Old session: ${result.oldSessionId}`);
            console.log(`   New session: ${result.newSessionId}`);

            // Reset health status
            await this.checkSessionHealth();

            return result;

        } catch (error: any) {
            console.error('❌ Session rotation failed:', error.message);
            result.error = error.message;

            // Try fallback: use environment variable session
            if (process.env.TELEGRAM_SESSION_STRING) {
                console.log('🔄 Attempting fallback to environment session...');
                try {
                    await this.useFallbackSession();
                    result.success = true;
                    result.fallbackUsed = true;
                    console.log('✅ Fallback session activated');
                } catch (fallbackError: any) {
                    console.error('❌ Fallback failed:', fallbackError.message);
                }
            }

            return result;
        }
    }

    /**
     * Use fallback session from environment
     */
    private async useFallbackSession(): Promise<void> {
        const sessionString = process.env.TELEGRAM_SESSION_STRING;
        const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER || '';
        
        if (!sessionString) {
            throw new Error('No fallback session available in environment');
        }

        // Test the fallback session
        const apiId = parseInt(process.env.TELEGRAM_API_ID || '');
        const apiHash = process.env.TELEGRAM_API_HASH || '';

        const stringSession = new StringSession(sessionString);
        const client = new TelegramClient(stringSession, apiId, apiHash, {
            connectionRetries: 2
        });

        await client.connect();
        const me = await client.getMe();
        if (!me) {
            throw new Error('Fallback session is invalid');
        }
        await client.disconnect();

        // Deactivate current session
        await deleteSessionFromDB('telegram-collector');

        // Save fallback session
        await saveSessionToDB(
            'telegram-collector',
            sessionString,
            phoneNumber,
            apiId.toString(),
            apiHash
        );
    }

    /**
     * Get current session health status
     */
    getHealthStatus(): SessionHealth {
        return this.sessionHealth;
    }

    /**
     * Force session rotation (for manual trigger)
     */
    async forceRotation(): Promise<RotationResult> {
        console.log('🔄 Manual session rotation triggered...');
        return await this.rotateSession();
    }

    /**
     * Cleanup and stop service
     */
    async shutdown() {
        console.log('🛑 Shutting down Session Rotation Service...');
        
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = undefined;
        }
        
        console.log('✅ Session Rotation Service stopped');
    }
}

// Singleton instance
const sessionRotationService = new SessionRotationService();

export default sessionRotationService;
export { SessionHealth, RotationResult };

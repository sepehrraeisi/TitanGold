const { upsertAccountSession } = require('../dist/utils/accountManager');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function addSessionToDb() {
    const phoneNumber = '+989384556010';
    const sessionString = process.env.TELEGRAM_SESSION_STRING;
    
    if (!sessionString) {
        console.error('❌ TELEGRAM_SESSION_STRING not found in .env');
        process.exit(1);
    }
    
    console.log('📱 Adding session for phone:', phoneNumber);
    console.log('📝 Session length:', sessionString.length);
    
    try {
        const account = await upsertAccountSession(phoneNumber, sessionString, {
            label: phoneNumber,
            isPrimary: true // Set as primary account
        });
        
        console.log('✅ Session added to telegram_accounts successfully!');
        console.log('   Account ID:', account.id);
        console.log('   Status:', account.status);
        console.log('   Is Primary:', account.is_primary);
        console.log('   Last Login:', account.last_login_at);
    } catch (error) {
        console.error('❌ Failed to add session to database:', error.message);
        console.error('   Stack:', error.stack);
        process.exit(1);
    }
}

addSessionToDb().then(() => {
    console.log('✅ Done!');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});

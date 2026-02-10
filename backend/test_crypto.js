import dotenv from 'dotenv';
import { encryptSecret, decryptSecret, isEncrypted } from './utils/crypto.js';

dotenv.config();

// Mock MASTER_KEY if not present
if (!process.env.MASTER_KEY) {
    process.env.MASTER_KEY = '0'.repeat(64);
}

const testData = JSON.stringify({ apiKey: '12345', apiSecret: 'abcde' });

try {
    const encrypted = encryptSecret(testData);
    console.log('Encrypted:', encrypted);
    console.log('Is Encrypted:', isEncrypted(encrypted));
    
    const decrypted = decryptSecret(encrypted);
    console.log('Decrypted:', decrypted);
    console.log('Match:', testData === decrypted);
} catch (e) {
    console.error('Test failed:', e.message);
}

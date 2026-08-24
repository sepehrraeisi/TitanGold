import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const MK2_PREFIX = 'mk2:';
const LEGACY_PARTS = 3;

function readHexKey(name, { required = false } = {}) {
  const keyHex = process.env[name];
  if (!keyHex) {
    if (required) {
      throw new Error(`${name} not set in environment`);
    }
    return null;
  }

  if (!/^[0-9a-f]+$/i.test(keyHex)) {
    throw new Error(`${name} must be 64 hex chars`);
  }

  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error(`${name} must be 32 bytes (64 hex chars), got ${key.length} bytes`);
  }
  return key;
}

export function getCurrentMasterKey() {
  return readHexKey('MASTER_KEY', { required: true });
}

export function getPreviousMasterKey() {
  return readHexKey('MASTER_KEY_PREVIOUS');
}

export function getMasterKeyContext() {
  return {
    current: getCurrentMasterKey(),
    previous: getPreviousMasterKey(),
  };
}

export function isLegacyEnvelope(value) {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length !== LEGACY_PARTS) return false;
  const hexRegex = /^[0-9a-f]+$/i;
  return parts.every((part) => hexRegex.test(part));
}

export function isMk2Envelope(value) {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith(MK2_PREFIX) && isLegacyEnvelope(value.slice(MK2_PREFIX.length));
}

export function classifyCiphertext(value) {
  if (!value || typeof value !== 'string') return 'empty';
  if (isMk2Envelope(value)) return 'mk2';
  if (isLegacyEnvelope(value)) return 'legacy';
  return 'malformed';
}

function encryptPayload(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

function decryptPayload(encrypted, key) {
  const parts = encrypted.split(':');
  if (parts.length !== LEGACY_PARTS) {
    throw new Error('Invalid encrypted format (expected iv:ciphertext:authTag)');
  }

  const [ivHex, ciphertext, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted format (unexpected iv/authTag size)');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function encryptMk2Secret(plaintext, context = getMasterKeyContext()) {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }
  try {
    return `${MK2_PREFIX}${encryptPayload(plaintext, context.current)}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

export function decryptCompatibleSecret(encrypted, context = getMasterKeyContext()) {
  if (!encrypted) {
    throw new Error('Cannot decrypt empty string');
  }

  const format = classifyCiphertext(encrypted);
  try {
    if (format === 'mk2') {
      return decryptPayload(encrypted.slice(MK2_PREFIX.length), context.current);
    }

    if (format === 'legacy') {
      const legacyKey = context.previous || context.current;
      if (!legacyKey) {
        throw new Error('MASTER_KEY_PREVIOUS not set for legacy decrypt');
      }
      return decryptPayload(encrypted, legacyKey);
    }

    throw new Error('Invalid encrypted format (expected iv:ciphertext:authTag or mk2:...)');
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

export function serializeMk2Payload(legacyPayload) {
  return `${MK2_PREFIX}${legacyPayload}`;
}

export function maskSecret(secret) {
  if (!secret || secret.length < 4) {
    return '***';
  }
  return '***' + secret.slice(-4);
}

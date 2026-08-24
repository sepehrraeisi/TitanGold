/**
 * Secret-safe evidence writer for T2 orchestrator.
 * Whitelist-only: counts, statuses, SHA256 of dump FILE, boolean flags.
 * Forbidden: raw env values, dump JSON, credentials, tokens.
 */

const FORBIDDEN_PATTERNS = [
  /postgres:\/\//i,
  /redis:\/\//i,
  /(?:^|[^\w])password\s*[:=]\s*(?!present\b|absent\b)/i,
  /DB_PASSWORD\s*=\s*(?!present\b|absent\b)/i,
  /TELEGRAM_BOT_TOKEN\s*=\s*(?!present\b|absent\b)/i,
  /API_KEY\s*=\s*(?!present\b|absent\b)/i,
  /API_SECRET\s*=\s*(?!present\b|absent\b)/i,
  /MASTER_KEY\s*=\s*(?!present\b|absent\b)/i,
  /JWT_SECRET\s*=\s*(?!present\b|absent\b)/i,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/,
];

export function assertSecretSafeLine(line) {
  const text = String(line);
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(text)) {
      throw new Error('SECRET_SAFE_EVIDENCE_VIOLATION');
    }
  }
  // crude value-leak guard: long hex/base64 blobs
  if (/[A-Za-z0-9+/]{48,}={0,2}/.test(text) && /password|token|secret|key/i.test(text)) {
    throw new Error('SECRET_SAFE_EVIDENCE_VIOLATION');
  }
}

export class SecretSafeEvidence {
  constructor() {
    /** @type {string[]} */
    this.lines = [];
  }

  log(...parts) {
    const line = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
    assertSecretSafeLine(line);
    this.lines.push(line);
    return line;
  }

  toString() {
    return this.lines.join('\n');
  }

  containsForbiddenSubstring(substr) {
    return this.lines.some((l) => l.includes(substr));
  }
}

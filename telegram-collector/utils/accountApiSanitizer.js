/**
 * Strip sensitive fields before returning telegram collector rows to browsers.
 */
function maskPhone(phone) {
    const raw = String(phone || '').trim();
    if (!raw) return '—';
    if (raw.length <= 4) return '****';
    return `${raw.slice(0, 3)}***${raw.slice(-2)}`;
}

function sanitizeAccountForApi(row) {
    if (!row || typeof row !== 'object') return row;
    const {
        session_string: _session,
        api_hash: _hash,
        api_id: _apiId,
        phone: rawPhone,
        ...safe
    } = row;
    const phone_masked = maskPhone(rawPhone || safe.phone);
    return {
        ...safe,
        phone: phone_masked,
        phone_masked,
        has_session: Boolean(_session),
    };
}

function sanitizeAccountsForApi(rows) {
    return (rows || []).map(sanitizeAccountForApi);
}

function sanitizeSessionStatusForApi(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const { phone_number, ...rest } = payload;
    if (phone_number != null) {
        return { ...rest, phone_masked: maskPhone(phone_number), has_phone: true };
    }
    return rest;
}

function sanitizeHealthSessionForApi(session) {
    if (!session || typeof session !== 'object') return session;
    const { phone_number, ...rest } = session;
    if (phone_number != null) {
        return { ...rest, phone_masked: maskPhone(phone_number) };
    }
    return rest;
}

function sanitizeLoginStartForApi(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const { phoneCodeHash: _hash, phoneNumber, ...rest } = payload;
    return {
        ...rest,
        phone_masked: maskPhone(phoneNumber),
    };
}

function sanitizeLoginConfirmForApi(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const { session: _session, phoneNumber, account, ...rest } = payload;
    const out = { ...rest };
    if (phoneNumber != null) out.phone_masked = maskPhone(phoneNumber);
    if (account) out.account = sanitizeAccountForApi(account);
    return out;
}

function sanitizeErrorMessage(message) {
    const raw = String(message || '').trim();
    if (!raw) return undefined;
    if (raw.includes('<html') || raw.includes('404 Not Found')) return 'Collector service unavailable';
    return raw.slice(0, 120);
}

module.exports = {
    maskPhone,
    sanitizeAccountForApi,
    sanitizeAccountsForApi,
    sanitizeSessionStatusForApi,
    sanitizeHealthSessionForApi,
    sanitizeLoginStartForApi,
    sanitizeLoginConfirmForApi,
    sanitizeErrorMessage,
};

/**
 * Strip sensitive fields before returning telegram account rows to browsers.
 */
function maskPhone(phone) {
    const raw = String(phone || '').trim();
    if (raw.length <= 4) return '****';
    return `${raw.slice(0, 3)}***${raw.slice(-2)}`;
}

function sanitizeAccountForApi(row) {
    if (!row || typeof row !== 'object') return row;
    const {
        session_string: _session,
        api_hash: _hash,
        api_id: _apiId,
        ...safe
    } = row;
    return {
        ...safe,
        phone_masked: maskPhone(safe.phone),
        has_session: Boolean(_session),
    };
}

function sanitizeAccountsForApi(rows) {
    return (rows || []).map(sanitizeAccountForApi);
}

module.exports = {
    maskPhone,
    sanitizeAccountForApi,
    sanitizeAccountsForApi,
};

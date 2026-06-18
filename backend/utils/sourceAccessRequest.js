/**
 * Extract runtime agent identity from HTTP request (query, header, or body context).
 */
export function resolveAgentKeyFromRequest(req) {
    const header =
        req.headers['x-agent-key'] ||
        req.headers['x-agentkey'] ||
        req.headers['x-titan-agent-key'];

    const fromHeader = Array.isArray(header) ? header[0] : header;
    if (fromHeader && String(fromHeader).trim()) {
        return String(fromHeader).trim();
    }

    const queryKey = req.query?.agentKey || req.query?.agent_key;
    if (queryKey && String(queryKey).trim()) {
        return String(queryKey).trim();
    }

    const bodyKey = req.body?.agentKey || req.body?.agent_key;
    if (bodyKey && String(bodyKey).trim()) {
        return String(bodyKey).trim();
    }

    return null;
}

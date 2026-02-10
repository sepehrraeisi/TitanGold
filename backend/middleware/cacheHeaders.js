/**
 * Cache Headers Middleware
 * Task: TASK-API-004
 * 
 * Sets strategic Cache-Control headers for performance and security.
 */

export const cacheHeaders = (req, res, next) => {
    // 1. Static Assets (/uploads) - Long-lived cache
    if (req.path.startsWith('/uploads')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return next();
    }

    // 2. GET Requests - Revalidate but allow local copy
    if (req.method === 'GET') {
        // Default GET behavior: check with server before using cache
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
    // 3. Mutation Requests (POST, PUT, DELETE, etc.) - No store
    else {
        // Sensitive operations should never be cached
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }

    next();
};

export default cacheHeaders;

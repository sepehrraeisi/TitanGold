/**
 * API Versioning Middleware
 * Task: API-001
 * 
 * Adds version header to all API responses and handles legacy redirects
 */

const API_VERSION = '1';

/**
 * Middleware to add API version header to all responses
 */
export const addVersionHeader = (req, res, next) => {
  res.setHeader('X-API-Version', API_VERSION);
  next();
};

/**
 * Middleware to redirect legacy routes (without /v1/) to versioned routes
 * Preserves backward compatibility for existing clients
 */
export const legacyRedirect = (req, res, next) => {
  // Skip if already versioned
  if (req.path.startsWith('/api/v1/')) {
    return next();
  }
  
  // Skip special routes that should remain unversioned
  const skipRoutes = ['/health', '/api/docs', '/api/docs.json', '/uploads'];
  if (skipRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  
  // Redirect /api/* to /api/v1/* (preserving query string)
  if (req.path.startsWith('/api/')) {
    const versionedPath = req.path.replace('/api/', '/api/v1/');
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const newUrl = versionedPath + queryString;
    
    // Use 301 for GET requests (cacheable), 308 for others (preserve method)
    const statusCode = req.method === 'GET' ? 301 : 308;
    
    return res.redirect(statusCode, newUrl);
  }
  
  next();
};

/**
 * Get current API version
 */
export const getApiVersion = () => API_VERSION;

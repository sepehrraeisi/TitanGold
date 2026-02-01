/**
 * Authentication and Authorization Utility Functions
 * 
 * Provides standardized role checking to handle case inconsistencies
 * between backend (lowercase: 'admin') and frontend types (capitalized: 'Admin')
 */

/**
 * Check if a user role is Admin (case-insensitive)
 * 
 * Backend returns: 'admin', 'trader', 'viewer' (lowercase)
 * TypeScript types: 'Admin', 'Trader', 'Viewer' (capitalized)
 * 
 * This helper ensures consistent role checking regardless of case.
 * 
 * @param role - User role string (can be undefined or null)
 * @returns true if role is 'admin' (case-insensitive), false otherwise
 * 
 * @example
 * ```typescript
 * const { user } = useAppContext();
 * const isAdmin = isAdminRole(user?.role);
 * 
 * if (isAdmin) {
 *   // Show admin features
 * }
 * ```
 */
export const isAdminRole = (role?: string | null): boolean => {
  return String(role || '').toLowerCase() === 'admin';
};

/**
 * Check if a user role is Trader (case-insensitive)
 * 
 * @param role - User role string (can be undefined or null)
 * @returns true if role is 'trader' (case-insensitive), false otherwise
 */
export const isTraderRole = (role?: string | null): boolean => {
  return String(role || '').toLowerCase() === 'trader';
};

/**
 * Check if a user role is Viewer (case-insensitive)
 * 
 * @param role - User role string (can be undefined or null)
 * @returns true if role is 'viewer' (case-insensitive), false otherwise
 */
export const isViewerRole = (role?: string | null): boolean => {
  return String(role || '').toLowerCase() === 'viewer';
};

/**
 * Get normalized role string (lowercase)
 * 
 * @param role - User role string (can be undefined or null)
 * @returns normalized lowercase role or empty string
 */
export const normalizeRole = (role?: string | null): string => {
  return String(role || '').toLowerCase();
};

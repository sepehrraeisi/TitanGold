/**
 * Pagination Utility
 * TASK-BE-010: Add pagination to GET endpoints
 * 
 * Provides consistent pagination helpers across all endpoints
 */

/**
 * Calculate pagination metadata
 * @param {number} page - Current page number (1-indexed)
 * @param {number} limit - Items per page
 * @param {number} totalCount - Total number of items
 * @returns {Object} Pagination metadata
 */
export function calculatePagination(page, limit, totalCount) {
    const currentPage = Math.max(1, parseInt(page) || 1);
    const itemsPerPage = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const total = parseInt(totalCount) || 0;
    const totalPages = Math.ceil(total / itemsPerPage);
    const offset = (currentPage - 1) * itemsPerPage;

    return {
        page: currentPage,
        limit: itemsPerPage,
        offset,
        total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
    };
}

/**
 * Format paginated response
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination metadata from calculatePagination
 * @returns {Object} Formatted response with data and pagination
 */
export function formatPaginatedResponse(data, pagination) {
    return {
        data,
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages: pagination.totalPages,
            hasNextPage: pagination.hasNextPage,
            hasPrevPage: pagination.hasPrevPage
        }
    };
}

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} Validation result with errors array
 */
export function validatePaginationParams(page, limit) {
    const errors = [];

    if (page !== undefined) {
        const pageNum = parseInt(page);
        if (isNaN(pageNum) || pageNum < 1) {
            errors.push('Page must be a positive integer');
        }
    }

    if (limit !== undefined) {
        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1) {
            errors.push('Limit must be a positive integer');
        } else if (limitNum > 100) {
            errors.push('Limit cannot exceed 100');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

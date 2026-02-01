/**
 * Zod Schema Validation Middleware
 * Task: API-002
 * 
 * Provides middleware for validating request body, query params, and path params
 * using Zod schemas with clear, actionable error messages.
 */

import { ZodError } from 'zod';
import { logger } from '../services/logger.js';

/**
 * Format Zod validation errors into a user-friendly structure
 * @param {ZodError} error - The Zod validation error
 * @returns {Object} Formatted error object
 */
function formatZodError(error) {
  const errors = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    expected: err.expected,
    received: err.received,
  }));

  return {
    ok: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: errors,
    },
  };
}

/**
 * Middleware factory to validate request body against a Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
export const validateBody = (schema) => {
  return async (req, res, next) => {
    try {
      // Parse and validate the request body
      req.validatedBody = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(formatZodError(error));
      }
      // Unexpected error
      logger.error('Validation middleware error:', error);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during validation',
        },
      });
    }
  };
};

/**
 * Middleware factory to validate query parameters against a Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
export const validateQuery = (schema) => {
  return async (req, res, next) => {
    try {
      // Parse and validate query parameters
      req.validatedQuery = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(formatZodError(error));
      }
      logger.error('Validation middleware error:', error);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during validation',
        },
      });
    }
  };
};

/**
 * Middleware factory to validate path parameters against a Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
export const validateParams = (schema) => {
  return async (req, res, next) => {
    try {
      // Parse and validate path parameters
      req.validatedParams = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(formatZodError(error));
      }
      logger.error('Validation middleware error:', error);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during validation',
        },
      });
    }
  };
};

/**
 * Middleware factory to validate multiple parts of the request
 * @param {Object} schemas - Object with body, query, and/or params schemas
 * @returns {Function} Express middleware
 */
export const validate = (schemas) => {
  return async (req, res, next) => {
    try {
      const errors = [];

      // Validate body if schema provided
      if (schemas.body) {
        try {
          req.validatedBody = await schemas.body.parseAsync(req.body);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.errors.map(err => ({
              ...err,
              location: 'body',
            })));
          } else {
            throw error;
          }
        }
      }

      // Validate query if schema provided
      if (schemas.query) {
        try {
          req.validatedQuery = await schemas.query.parseAsync(req.query);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.errors.map(err => ({
              ...err,
              location: 'query',
            })));
          } else {
            throw error;
          }
        }
      }

      // Validate params if schema provided
      if (schemas.params) {
        try {
          req.validatedParams = await schemas.params.parseAsync(req.params);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...error.errors.map(err => ({
              ...err,
              location: 'params',
            })));
          } else {
            throw error;
          }
        }
      }

      // If there are validation errors, return them
      if (errors.length > 0) {
        const formattedErrors = errors.map(err => ({
          field: err.path.join('.'),
          location: err.location || 'unknown',
          message: err.message,
          code: err.code,
          expected: err.expected,
          received: err.received,
        }));

        return res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: formattedErrors,
          },
        });
      }

      next();
    } catch (error) {
      logger.error('Validation middleware error:', error);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during validation',
        },
      });
    }
  };
};

/**
 * Central Schema Export
 * Task: API-002
 * 
 * Exports all Zod schemas for easy importing throughout the application
 */

import agentSchemas from './agentSchemas.js';
import authSchemas from './authSchemas.js';
import userSchemas from './userSchemas.js';
import portfolioSchemas from './portfolioSchemas.js';
import tradeSchemas from './tradeSchemas.js';

export {
  agentSchemas,
  authSchemas,
  userSchemas,
  portfolioSchemas,
  tradeSchemas,
};

// Re-export validation middleware
export { validateBody, validateQuery, validateParams, validate } from '../middleware/validation.js';

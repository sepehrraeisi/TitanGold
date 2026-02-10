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
import artemisSchemas from './artemisSchemas.js';
import autopilotSchemas from './autopilotSchemas.js';
import * as dataHubSchemas from './dataHubSchemas.js';
import accessControlSchemas from './accessControlSchemas.js';

export {
  agentSchemas,
  authSchemas,
  userSchemas,
  portfolioSchemas,
  tradeSchemas,
  artemisSchemas,
  autopilotSchemas,
  dataHubSchemas,
  accessControlSchemas
};

// Re-export validation middleware
export { validateBody, validateQuery, validateParams, validate } from '../middleware/validation.js';

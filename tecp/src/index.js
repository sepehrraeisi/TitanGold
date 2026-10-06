export {
  CANONICAL_CONFIG_KEYS,
  TECP_CONTRACT_VERSION,
  TECP_SERVICE_NAME,
  TECP_SLICE_ID,
  createCanonicalConfig,
  validateConfig,
} from './config.js';
export { evaluateHealth } from './health.js';
export { createService } from './service.js';
export { GITHUB_PORT_CONTRACT, createGithubPort } from './ports/githubPort.js';
export { LINEAR_PORT_CONTRACT, createLinearPort } from './ports/linearPort.js';

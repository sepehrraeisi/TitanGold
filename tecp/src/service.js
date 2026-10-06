import { TECP_CONTRACT_VERSION, createCanonicalConfig, validateConfig } from './config.js';
import { evaluateHealth } from './health.js';
import { createGithubPort } from './ports/githubPort.js';
import { createLinearPort } from './ports/linearPort.js';

function fail(code, message) {
  const error = new Error(message);
  error.name = 'TecpLifecycleError';
  error.code = code;
  return error;
}

function createSideEffects() {
  return {
    networkRequests: 0,
    githubMutations: 0,
    linearMutations: 0,
    dbWrites: 0,
    redisWrites: 0,
    filesystemRuntimePersistence: 0,
    schedulerStarts: 0,
    workerStarts: 0,
    productionRuntime: 0,
  };
}

export function createService(input = createCanonicalConfig()) {
  const config = validateConfig(input);
  const github = createGithubPort();
  const linear = createLinearPort();
  const sideEffects = createSideEffects();
  let lifecycle = 'CREATED';

  function snapshot() {
    return {
      lifecycle,
      config,
      github,
      linear,
      sideEffects,
    };
  }

  const service = {
    contractVersion: TECP_CONTRACT_VERSION,
    getConfig() {
      return config;
    },
    getLifecycle() {
      return lifecycle;
    },
    getSideEffects() {
      return Object.freeze({ ...sideEffects });
    },
    getPorts() {
      return Object.freeze({ github, linear });
    },
    start() {
      if (lifecycle !== 'CREATED') {
        throw fail('INVALID_START', `TECP cannot start from ${lifecycle}`);
      }
      lifecycle = 'STARTED';
      return evaluateHealth(snapshot());
    },
    stop() {
      if (lifecycle !== 'STARTED') {
        throw fail('INVALID_STOP', `TECP cannot stop from ${lifecycle}`);
      }
      lifecycle = 'STOPPED';
      return evaluateHealth(snapshot());
    },
    getHealth() {
      return evaluateHealth(snapshot());
    },
  };

  return Object.freeze(service);
}

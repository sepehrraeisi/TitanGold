export const GITHUB_PORT_CONTRACT = Object.freeze({
  portId: 'github',
  sliceId: 'TECP-003-SERVICE-SKELETON',
  kind: 'FAIL_CLOSED_STUB',
  liveAuthority: false,
  networkEnabled: false,
  mutationEnabled: false,
  credentialAccess: false,
  sdkBound: false,
});

function deny(operationName) {
  const error = new Error('GitHub port is fail-closed; live authority is absent');
  error.name = 'TecpFailClosedError';
  error.code = 'GITHUB_PORT_FAIL_CLOSED';
  error.operation = operationName;
  return error;
}

export function createGithubPort() {
  const sideEffects = Object.freeze({
    networkRequests: 0,
    mutations: 0,
    credentialReads: 0,
  });

  return Object.freeze({
    contract: GITHUB_PORT_CONTRACT,
    sideEffects,
    invoke(operationName) {
      throw deny(operationName);
    },
  });
}

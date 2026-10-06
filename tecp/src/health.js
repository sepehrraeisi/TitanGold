const ZERO_SIDE_EFFECT_KEYS = Object.freeze([
  'networkRequests',
  'githubMutations',
  'linearMutations',
  'dbWrites',
  'redisWrites',
  'filesystemRuntimePersistence',
  'schedulerStarts',
  'workerStarts',
  'productionRuntime',
]);

function unavailable(lifecycle, reason) {
  return Object.freeze({
    status: 'unavailable',
    lifecycle,
    reason,
    persistence: 'none',
    outboundNetwork: false,
    githubLiveAuthority: false,
    linearLiveAuthority: false,
    sideEffects: Object.freeze({
      networkRequests: 0,
      githubMutations: 0,
      linearMutations: 0,
      dbWrites: 0,
      redisWrites: 0,
      filesystemRuntimePersistence: 0,
      schedulerStarts: 0,
      workerStarts: 0,
      productionRuntime: 0,
    }),
  });
}

export function evaluateHealth(snapshot) {
  const lifecycle = snapshot?.lifecycle;
  const github = snapshot?.github;
  const linear = snapshot?.linear;
  const sideEffects = snapshot?.sideEffects;

  if (github?.contract?.liveAuthority !== false || github?.contract?.networkEnabled !== false) {
    return unavailable(lifecycle ?? 'UNKNOWN', 'GITHUB_LIVE_AUTHORITY');
  }
  if (linear?.contract?.liveAuthority !== false || linear?.contract?.networkEnabled !== false) {
    return unavailable(lifecycle ?? 'UNKNOWN', 'LINEAR_LIVE_AUTHORITY');
  }
  if (github?.sideEffects?.networkRequests !== 0 || github?.sideEffects?.mutations !== 0) {
    return unavailable(lifecycle ?? 'UNKNOWN', 'GITHUB_SIDE_EFFECT');
  }
  if (linear?.sideEffects?.networkRequests !== 0 || linear?.sideEffects?.mutations !== 0) {
    return unavailable(lifecycle ?? 'UNKNOWN', 'LINEAR_SIDE_EFFECT');
  }
  if (sideEffects == null) {
    return unavailable(lifecycle ?? 'UNKNOWN', 'SIDE_EFFECT_LEDGER_MISSING');
  }
  for (const key of ZERO_SIDE_EFFECT_KEYS) {
    if (sideEffects[key] !== 0) {
      return unavailable(lifecycle ?? 'UNKNOWN', 'SIDE_EFFECT_LEDGER');
    }
  }
  if (snapshot?.config?.persistence !== 'none' || snapshot?.config?.outboundNetwork !== false) {
    return unavailable(lifecycle ?? 'UNKNOWN', 'CONFIG_BOUNDARY');
  }
  if (lifecycle !== 'STARTED') {
    return unavailable(lifecycle ?? 'UNKNOWN', lifecycle === 'STOPPED' ? 'STOPPED' : 'NOT_STARTED');
  }

  return Object.freeze({
    status: 'ok',
    lifecycle: 'STARTED',
    reason: 'LOCAL_SKELETON_READY',
    persistence: 'none',
    outboundNetwork: false,
    githubLiveAuthority: false,
    linearLiveAuthority: false,
    sideEffects: Object.freeze({
      networkRequests: 0,
      githubMutations: 0,
      linearMutations: 0,
      dbWrites: 0,
      redisWrites: 0,
      filesystemRuntimePersistence: 0,
      schedulerStarts: 0,
      workerStarts: 0,
      productionRuntime: 0,
    }),
  });
}

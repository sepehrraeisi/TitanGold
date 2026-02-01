// Polyfills for WalletConnect SDK
if (typeof global === 'undefined') {
  (window as any).global = globalThis;
}

if (typeof process === 'undefined') {
  (window as any).process = {
    env: {},
    version: '',
    versions: {},
    platform: 'browser',
    nextTick: (fn: Function) => setTimeout(fn, 0),
  };
}

export {};

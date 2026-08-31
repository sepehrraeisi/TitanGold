import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { titangoldProductionBuildGuardPlugin } from './scripts/guard-production-build.mjs';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiProxyTarget =
      process.env.VITE_API_PROXY_TARGET ||
      env.VITE_API_PROXY_TARGET ||
      'http://127.0.0.1:5002';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // Specific external API proxies (must come first)
          '/api/telegram-collector': {
            target: 'http://localhost:5003',
            changeOrigin: true,
            secure: false,
          },
          '/api/mexc': {
            target: 'https://api.mexc.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/mexc/, ''),
            secure: true,
            configure: (proxy, _options) => {
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                // Forward headers
                if (req.headers['x-mexc-apikey']) {
                  proxyReq.setHeader('X-MEXC-APIKEY', req.headers['x-mexc-apikey'] as string);
                }
              });
            }
          },
          // Proxy all other /api/* requests to backend server
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
            secure: false,
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('Proxy error:', err);
              });
            }
          }
        }
      },
      plugins: [react(), titangoldProductionBuildGuardPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'global': 'globalThis', // Fix for WalletConnect SDK
      },
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('.', import.meta.url)),
        }
      },
      optimizeDeps: {
        include: ['@google/genai', '@walletconnect/ethereum-provider'],
        exclude: []
      },
      build: {
        ...(process.env.TITANGOLD_VITE_OUTDIR
          ? { outDir: path.resolve(process.env.TITANGOLD_VITE_OUTDIR) }
          : {}),
        commonjsOptions: {
          include: [/@google\/genai/, /@walletconnect/, /node_modules/]
        }
      }
    };
});

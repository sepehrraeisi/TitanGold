import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/telegram': {
            target: 'https://api.telegram.org',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/telegram/, ''),
            secure: true,
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
          }
        }
      },
      plugins: [react()],
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
        commonjsOptions: {
          include: [/@google\/genai/, /@walletconnect/, /node_modules/]
        }
      }
    };
});

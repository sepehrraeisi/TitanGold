/**
 * @jest-environment node
 */
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { attachSharedUpgradeRouter } from '../../websocket/attachUpgradeRouter.js';

describe('attachSharedUpgradeRouter', () => {
  /** @type {import('http').Server} */
  let server;
  /** @type {number} */
  let port;
  const servers = {};

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    for (const path of ['/ws/notifications', '/ws/agents', '/ws/favorites']) {
      servers[path] = new WebSocketServer({ noServer: true });
      servers[path].on('connection', (ws) => {
        ws.send(JSON.stringify({ type: 'ok', path }));
      });
    }
    attachSharedUpgradeRouter(server, {
      '/ws/notifications': servers['/ws/notifications'],
      '/ws/agents': servers['/ws/agents'],
      '/ws/favorites': servers['/ws/favorites'],
    });
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    Object.values(servers).forEach((wss) => wss.close());
    await new Promise((resolve) => server.close(resolve));
  });

  async function openPath(path) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
      const timer = setTimeout(() => {
        try { ws.terminate(); } catch { /* ignore */ }
        reject(new Error(`timeout ${path}`));
      }, 3000);
      ws.on('message', (data) => {
        clearTimeout(timer);
        const msg = JSON.parse(data.toString());
        ws.close();
        resolve(msg);
      });
      ws.on('unexpected-response', (_req, res) => {
        clearTimeout(timer);
        reject(new Error(`HTTP ${res.statusCode} for ${path}`));
      });
      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  it('routes all three websocket paths without HTTP 400', async () => {
    const a = await openPath('/ws/notifications');
    const b = await openPath('/ws/agents');
    const c = await openPath('/ws/favorites');
    expect(a.path).toBe('/ws/notifications');
    expect(b.path).toBe('/ws/agents');
    expect(c.path).toBe('/ws/favorites');
  });
});

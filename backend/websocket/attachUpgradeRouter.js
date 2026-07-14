/**
 * Shared HTTP upgrade router for multiple WebSocketServer instances.
 *
 * The `ws` library aborts with 400 when a path-scoped server does not match.
 * Attaching several `{ server, path }` instances therefore breaks all but the
 * first path. Use noServer servers + this single upgrade listener instead.
 */

import { parse as parseUrl } from 'url';
import { logger } from '../services/logger.js';

const ROUTER_FLAG = Symbol.for('titan.ws.upgradeRouterAttached');

/**
 * @param {import('http').Server} httpServer
 * @param {Map<string, import('ws').WebSocketServer>|Record<string, import('ws').WebSocketServer>} routeMap
 */
export function attachSharedUpgradeRouter(httpServer, routeMap) {
  if (!httpServer) {
    throw new Error('attachSharedUpgradeRouter requires an HTTP server');
  }

  const routes = routeMap instanceof Map
    ? routeMap
    : new Map(Object.entries(routeMap || {}));

  if (httpServer[ROUTER_FLAG]) {
    httpServer[ROUTER_FLAG] = routes;
    logger.info('🔌 WebSocket upgrade router routes updated', {
      paths: [...routes.keys()],
    });
    return;
  }

  httpServer[ROUTER_FLAG] = routes;

  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname } = parseUrl(req.url || '', true);
    const activeRoutes = httpServer[ROUTER_FLAG];
    const wss = activeRoutes?.get(pathname);

    if (!wss) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch (err) {
      logger.warn(`WebSocket upgrade failed for ${pathname}: ${err.message}`);
      try {
        socket.destroy();
      } catch {
        // ignore
      }
    }
  });

  logger.info('🔌 Shared WebSocket upgrade router attached', {
    paths: [...routes.keys()],
  });
}

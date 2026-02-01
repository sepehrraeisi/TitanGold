import { WebSocketServer } from 'ws';
import { logger } from './logger.js';

let wss = null;

export function initWebsocket(server) {
  if (wss) return wss;

  wss = new WebSocketServer({ server, path: '/ws/notifications' });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    logger.info('websocket_connected', { ip });

    ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to TitanGold notifications' }));

    ws.on('close', () => logger.info('websocket_disconnected', { ip }));
    ws.on('error', (err) => logger.warn('websocket_error', { ip, error: err.message }));
  });

  return wss;
}

export function broadcastNotification(payload) {
  if (!wss) return;
  const message = JSON.stringify({ type: 'notification', ...payload });
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}


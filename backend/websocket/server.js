/**
 * WebSocket Server for Real-Time Agent Updates
 * BACKEND-023: Add WebSocket Support for Real-Time Updates
 * 
 * Features:
 * - Token-based authentication
 * - Agent update streaming
 * - User-specific subscriptions
 * - Automatic reconnection support (heartbeat)
 * - Room-based broadcasting (per agent, per user)
 */

import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { parse as parseUrl } from 'url';
import { logger } from '../services/logger.js';

let wss = null;
const clients = new Map(); // Map<userId, Set<WebSocket>>
const subscriptions = new Map(); // Map<clientId, Set<subscriptionKey>>
const heartbeatInterval = 30000; // 30 seconds

/**
 * Initialize Agent WebSocket server (noServer).
 * Must be registered with attachSharedUpgradeRouter at path `/ws/agents`.
 *
 * Auth preference: post-connect `{ type: 'auth', token }` so JWTs never appear in
 * the WebSocket URL (browser console would otherwise leak them on handshake failure).
 * Legacy `?token=` is still accepted but must not be logged.
 *
 * @returns {WebSocketServer}
 */
export function initAgentWebSocketServer() {
  if (wss) {
    logger.info('🔌 WebSocket server already initialized');
    return wss;
  }

  wss = new WebSocketServer({
    noServer: true,
    maxPayload: 10 * 1024 * 1024 // 10MB
  });

  logger.info('🚀 Initializing WebSocket server at /ws/agents (noServer)');

  wss.on('connection', async (ws, req) => {
    const ip = req.socket.remoteAddress;
    const url = parseUrl(req.url, true);
    const tokenFromQuery = typeof url.query.token === 'string' ? url.query.token : null;
    const tokenFromHeader = req.headers.authorization?.split(' ')[1] || null;
    const bootstrapToken = tokenFromQuery || tokenFromHeader;

    ws.isAlive = true;
    ws.connectedAt = new Date();
    ws.authDeadline = setTimeout(() => {
      if (!ws.userId) {
        try {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'AUTH_REQUIRED',
            message: 'Authentication token required. Send { type: "auth", token } after connect.',
          }));
        } catch {
          // ignore
        }
        ws.close(1008, 'Authentication required');
      }
    }, 10000);

    const authenticate = (token) => {
      if (!token) {
        throw new Error('Authentication token required');
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId || decoded.id;
      const userEmail = decoded.email;
      if (!userId) {
        throw new Error('Invalid token: missing userId');
      }

      if (ws.authDeadline) {
        clearTimeout(ws.authDeadline);
        ws.authDeadline = null;
      }

      const clientId = `${userId}-${Date.now()}`;
      ws.userId = userId;
      ws.userEmail = userEmail;
      ws.clientId = clientId;

      if (!clients.has(userId)) {
        clients.set(userId, new Set());
      }
      clients.get(userId).add(ws);
      subscriptions.set(clientId, new Set());

      logger.info(`🔌 WebSocket connected: user=${userId}, ip=${ip}, clientId=${clientId}`);

      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to TitanGold Agent Updates',
        userId,
        clientId,
        timestamp: new Date().toISOString(),
        serverTime: Date.now(),
      }));
    };

    try {
      if (bootstrapToken) {
        authenticate(bootstrapToken);
      } else {
        ws.send(JSON.stringify({
          type: 'auth_required',
          message: 'Send { type: "auth", token } to authenticate',
        }));
      }
    } catch (authError) {
      logger.warn(`❌ WebSocket auth failed: ${authError.message}, ip=${ip}`);
      try {
        ws.send(JSON.stringify({
          type: 'error',
          code: 'AUTH_FAILED',
          message: 'Invalid or expired token',
        }));
      } catch {
        // ignore
      }
      ws.close(1008, 'Authentication failed');
      return;
    }

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (!ws.userId) {
          if (message.type === 'auth' && message.token) {
            try {
              authenticate(message.token);
            } catch (authError) {
              logger.warn(`❌ WebSocket auth failed: ${authError.message}, ip=${ip}`);
              ws.send(JSON.stringify({
                type: 'error',
                code: 'AUTH_FAILED',
                message: 'Invalid or expired token',
              }));
              ws.close(1008, 'Authentication failed');
            }
            return;
          }
          ws.send(JSON.stringify({
            type: 'error',
            code: 'AUTH_REQUIRED',
            message: 'Authenticate before sending other messages',
          }));
          return;
        }
        handleClientMessage(ws, message);
      } catch (err) {
        logger.warn(`⚠️ Invalid WebSocket message from user=${ws.userId || 'pending'}: ${err.message}`);
        try {
          ws.send(JSON.stringify({
            type: 'error',
            code: 'INVALID_MESSAGE',
            message: 'Invalid JSON message',
          }));
        } catch {
          // ignore
        }
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', (code, reason) => {
      if (ws.authDeadline) {
        clearTimeout(ws.authDeadline);
        ws.authDeadline = null;
      }
      cleanupClient(ws);
      logger.info(`🔌 WebSocket disconnected: user=${ws.userId || 'pending'}, code=${code}, reason=${reason || 'none'}`);
    });

    ws.on('error', (error) => {
      logger.error(`❌ WebSocket error: user=${ws.userId || 'pending'}, error=${error.message}`);
      cleanupClient(ws);
    });
  });

  // Heartbeat to detect dead connections
  const heartbeat = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        logger.info(`💀 Terminating dead connection: user=${ws.userId}, clientId=${ws.clientId}`);
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, heartbeatInterval);

  wss.on('close', () => {
    clearInterval(heartbeat);
    logger.info('🔌 WebSocket server closed');
  });

  logger.info('✅ WebSocket server initialized successfully');
  return wss;
}

/**
 * Handle client messages (subscribe, unsubscribe, ping)
 */
function handleClientMessage(ws, message) {
  const { type, payload } = message;

  switch (type) {
    case 'subscribe':
      handleSubscribe(ws, payload);
      break;
    
    case 'unsubscribe':
      handleUnsubscribe(ws, payload);
      break;
    
    case 'ping':
      ws.send(JSON.stringify({ 
        type: 'pong', 
        timestamp: new Date().toISOString(),
        serverTime: Date.now()
      }));
      break;
    
    default:
      ws.send(JSON.stringify({
        type: 'error',
        code: 'UNKNOWN_MESSAGE_TYPE',
        message: `Unknown message type: ${type}`
      }));
  }
}

/**
 * Handle subscription requests
 * Supported channels:
 * - agent:* (all agents)
 * - agent:{agent_id} (specific agent)
 * - agent:{agent_id}:status (agent status changes)
 * - agent:{agent_id}:result (agent execution results)
 * - user:{user_id} (user-specific updates)
 */
function handleSubscribe(ws, payload) {
  const { channel } = payload;

  if (!channel) {
    ws.send(JSON.stringify({
      type: 'error',
      code: 'MISSING_CHANNEL',
      message: 'Channel is required for subscription'
    }));
    return;
  }

  // Validate channel access (users can only subscribe to their own updates)
  if (channel.startsWith('user:') && !channel.startsWith(`user:${ws.userId}`)) {
    ws.send(JSON.stringify({
      type: 'error',
      code: 'FORBIDDEN',
      message: 'Cannot subscribe to other users\' channels'
    }));
    return;
  }

  const clientSubs = subscriptions.get(ws.clientId);
  clientSubs.add(channel);

  logger.info(`📡 Subscription added: user=${ws.userId}, channel=${channel}`);

  ws.send(JSON.stringify({
    type: 'subscribed',
    channel: channel,
    timestamp: new Date().toISOString()
  }));
}

/**
 * Handle unsubscribe requests
 */
function handleUnsubscribe(ws, payload) {
  const { channel } = payload;

  if (!channel) {
    ws.send(JSON.stringify({
      type: 'error',
      code: 'MISSING_CHANNEL',
      message: 'Channel is required for unsubscription'
    }));
    return;
  }

  const clientSubs = subscriptions.get(ws.clientId);
  clientSubs.delete(channel);

  logger.info(`📡 Subscription removed: user=${ws.userId}, channel=${channel}`);

  ws.send(JSON.stringify({
    type: 'unsubscribed',
    channel: channel,
    timestamp: new Date().toISOString()
  }));
}

/**
 * Cleanup client on disconnect
 */
function cleanupClient(ws) {
  const { userId, clientId } = ws;

  // Remove from clients map
  if (userId && clients.has(userId)) {
    const userClients = clients.get(userId);
    userClients.delete(ws);
    if (userClients.size === 0) {
      clients.delete(userId);
    }
  }

  // Remove subscriptions
  if (clientId) {
    subscriptions.delete(clientId);
  }
}

/**
 * Broadcast agent update to subscribed clients
 * @param {string} channel - Channel to broadcast to (e.g., 'agent:abc-123', 'agent:*')
 * @param {object} data - Data to broadcast
 * @param {string} userId - Optional: only send to specific user
 */
export function broadcastAgentUpdate(channel, data, userId = null) {
  if (!wss) {
    logger.warn('⚠️ WebSocket server not initialized, cannot broadcast');
    return;
  }

  const message = JSON.stringify({
    type: 'agent_update',
    channel: channel,
    data: data,
    timestamp: new Date().toISOString()
  });

  let sentCount = 0;

  wss.clients.forEach((client) => {
    // Check if client is alive and ready
    if (client.readyState !== 1) return;

    // Filter by userId if specified
    if (userId && client.userId !== userId) return;

    // Check if client is subscribed to this channel
    const clientSubs = subscriptions.get(client.clientId);
    if (!clientSubs) return;

    const isSubscribed = 
      clientSubs.has(channel) || 
      clientSubs.has('agent:*') ||
      (channel.includes(':') && clientSubs.has(channel.split(':')[0] + ':*'));

    if (isSubscribed) {
      client.send(message);
      sentCount++;
    }
  });

  if (sentCount > 0) {
    logger.info(`📤 Broadcast: channel=${channel}, recipients=${sentCount}`);
  }
}

/**
 * Send agent execution started event
 */
export function notifyAgentStarted(agentId, agentKey, userId, payload = {}) {
  broadcastAgentUpdate(`agent:${agentId}`, {
    event: 'execution_started',
    agent_id: agentId,
    agent_key: agentKey,
    ...payload
  }, userId);

  // Also broadcast to global agent channel
  broadcastAgentUpdate('agent:*', {
    event: 'execution_started',
    agent_id: agentId,
    agent_key: agentKey,
    user_id: userId,
    ...payload
  });
}

/**
 * Send agent execution completed event
 */
export function notifyAgentCompleted(agentId, agentKey, userId, result, payload = {}) {
  broadcastAgentUpdate(`agent:${agentId}`, {
    event: 'execution_completed',
    agent_id: agentId,
    agent_key: agentKey,
    result: result,
    ...payload
  }, userId);

  // Also broadcast to user channel
  broadcastAgentUpdate(`user:${userId}`, {
    event: 'agent_completed',
    agent_id: agentId,
    agent_key: agentKey,
    result: result,
    ...payload
  }, userId);
}

/**
 * Send agent execution failed event
 */
export function notifyAgentFailed(agentId, agentKey, userId, error, payload = {}) {
  broadcastAgentUpdate(`agent:${agentId}`, {
    event: 'execution_failed',
    agent_id: agentId,
    agent_key: agentKey,
    error: {
      message: error.message || 'Unknown error',
      code: error.code || 'EXECUTION_ERROR'
    },
    ...payload
  }, userId);

  // Also broadcast to user channel
  broadcastAgentUpdate(`user:${userId}`, {
    event: 'agent_failed',
    agent_id: agentId,
    agent_key: agentKey,
    error: {
      message: error.message || 'Unknown error',
      code: error.code || 'EXECUTION_ERROR'
    },
    ...payload
  }, userId);
}

/**
 * Send agent status change event
 */
export function notifyAgentStatusChange(agentId, agentKey, newStatus, oldStatus) {
  broadcastAgentUpdate(`agent:${agentId}:status`, {
    event: 'status_changed',
    agent_id: agentId,
    agent_key: agentKey,
    new_status: newStatus,
    old_status: oldStatus
  });

  // Also broadcast to global agent channel
  broadcastAgentUpdate('agent:*', {
    event: 'status_changed',
    agent_id: agentId,
    agent_key: agentKey,
    new_status: newStatus,
    old_status: oldStatus
  });
}

/**
 * Send agent progress update (for long-running operations)
 */
export function notifyAgentProgress(agentId, agentKey, userId, progress, message) {
  broadcastAgentUpdate(`agent:${agentId}`, {
    event: 'execution_progress',
    agent_id: agentId,
    agent_key: agentKey,
    progress: progress, // 0-100
    message: message
  }, userId);
}

/**
 * Get WebSocket server stats
 */
export function getWebSocketStats() {
  if (!wss) {
    return {
      initialized: false,
      clients: 0,
      users: 0
    };
  }

  const stats = {
    initialized: true,
    totalClients: wss.clients.size,
    uniqueUsers: clients.size,
    subscriptions: subscriptions.size,
    clientsByUser: {}
  };

  // Count clients per user
  clients.forEach((userClients, userId) => {
    stats.clientsByUser[userId] = userClients.size;
  });

  return stats;
}

/**
 * Close WebSocket server gracefully
 */
export function closeWebSocketServer() {
  if (!wss) return;

  logger.info('🔌 Closing WebSocket server...');

  // Send close message to all clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'server_shutdown',
        message: 'Server is shutting down',
        timestamp: new Date().toISOString()
      }));
      client.close(1001, 'Server shutdown');
    }
  });

  wss.close(() => {
    logger.info('✅ WebSocket server closed');
  });

  wss = null;
  clients.clear();
  subscriptions.clear();
}

export default {
  initAgentWebSocketServer,
  broadcastAgentUpdate,
  notifyAgentStarted,
  notifyAgentCompleted,
  notifyAgentFailed,
  notifyAgentStatusChange,
  notifyAgentProgress,
  getWebSocketStats,
  closeWebSocketServer
};

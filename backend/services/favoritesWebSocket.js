/**
 * ============================================================================
 * WebSocket Service for Real-time Price Updates
 * ============================================================================
 * Broadcasts price updates to connected clients for their favorites
 * ============================================================================
 */

import { WebSocketServer, WebSocket } from 'ws';
import pool from '../database/db.js';
import axios from 'axios';

class FavoritesWebSocketService {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // userId -> Set of WebSocket connections
        this.priceCache = new Map(); // symbol -> last price
        this.updateInterval = null;
        this.UPDATE_FREQUENCY = 5000; // 5 seconds
    }

    /**
     * Initialize WebSocket server
     */
    initialize(server) {
        this.wss = new WebSocketServer({ 
            server,
            path: '/ws/favorites'
        });

        this.wss.on('connection', (ws, req) => {
            console.log('📡 WebSocket client connected');

            // Handle authentication
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    
                    if (data.type === 'auth') {
                        await this.handleAuth(ws, data.token);
                    }
                } catch (error) {
                    console.error('WebSocket message error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format'
                    }));
                }
            });

            ws.on('close', () => {
                console.log('📡 WebSocket client disconnected');
                this.removeClient(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.removeClient(ws);
            });
        });

        // Start price update loop
        this.startPriceUpdateLoop();

        console.log('✅ WebSocket service initialized on /ws/favorites');
    }

    /**
     * Handle client authentication
     */
    async handleAuth(ws, token) {
        try {
            // Verify JWT token (simplified - should use proper JWT verification)
            // For now, we'll extract userId from token
            // In production, use jwt.verify()
            
            // Mock: Extract userId from token (you should implement proper JWT verification)
            const userId = this.extractUserIdFromToken(token);
            
            if (!userId) {
                ws.send(JSON.stringify({
                    type: 'auth_error',
                    message: 'Invalid token'
                }));
                ws.close();
                return;
            }

            // Store client
            ws.userId = userId;
            if (!this.clients.has(userId)) {
                this.clients.set(userId, new Set());
            }
            this.clients.get(userId).add(ws);

            // Send success message
            ws.send(JSON.stringify({
                type: 'auth_success',
                message: 'Authenticated successfully'
            }));

            // Send initial price data
            await this.sendInitialPrices(ws, userId);

            console.log(`✅ Client authenticated: userId=${userId}, total connections=${this.clients.size}`);
        } catch (error) {
            console.error('Auth error:', error);
            ws.send(JSON.stringify({
                type: 'auth_error',
                message: 'Authentication failed'
            }));
            ws.close();
        }
    }

    /**
     * Extract userId from JWT token (simplified)
     * TODO: Implement proper JWT verification
     */
    extractUserIdFromToken(token) {
        try {
            // This is a simplified version
            // In production, use: jwt.verify(token, JWT_SECRET)
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            return payload.userId || payload.id || payload.sub;
        } catch (error) {
            console.error('Token extraction error:', error);
            return null;
        }
    }

    /**
     * Remove client from tracking
     */
    removeClient(ws) {
        if (ws.userId && this.clients.has(ws.userId)) {
            const userClients = this.clients.get(ws.userId);
            userClients.delete(ws);
            
            if (userClients.size === 0) {
                this.clients.delete(ws.userId);
            }
        }
    }

    /**
     * Send initial price data to newly connected client
     */
    async sendInitialPrices(ws, userId) {
        try {
            // Get user's favorites
            const result = await pool.query(
                'SELECT asset_id, symbol, name FROM favorites WHERE user_id = $1',
                [userId]
            );

            if (result.rows.length === 0) {
                ws.send(JSON.stringify({
                    type: 'initial_prices',
                    data: []
                }));
                return;
            }

            // Fetch current prices
            const symbols = result.rows.map(f => f.asset_id);
            const prices = await this.fetchPricesFromMEXC(symbols);

            ws.send(JSON.stringify({
                type: 'initial_prices',
                data: prices
            }));
        } catch (error) {
            console.error('Error sending initial prices:', error);
        }
    }

    /**
     * Start price update loop
     */
    startPriceUpdateLoop() {
        this.updateInterval = setInterval(async () => {
            await this.broadcastPriceUpdates();
        }, this.UPDATE_FREQUENCY);

        console.log(`✅ Price update loop started (every ${this.UPDATE_FREQUENCY}ms)`);
    }

    /**
     * Broadcast price updates to all connected clients
     */
    async broadcastPriceUpdates() {
        if (this.clients.size === 0) {
            return; // No connected clients
        }

        try {
            // Get unique user IDs
            const userIds = Array.from(this.clients.keys());

            // Fetch favorites for all connected users
            const result = await pool.query(
                `SELECT DISTINCT asset_id, symbol 
                 FROM favorites 
                 WHERE user_id = ANY($1::uuid[])`,
                [userIds]
            );

            if (result.rows.length === 0) {
                return;
            }

            const symbols = result.rows.map(f => f.asset_id);
            
            // Fetch current prices
            const prices = await this.fetchPricesFromMEXC(symbols);

            // Detect changes and broadcast
            const updates = [];
            for (const priceData of prices) {
                const { symbol, price, change24h } = priceData;
                const cachedPrice = this.priceCache.get(symbol);

                if (!cachedPrice || cachedPrice !== price) {
                    this.priceCache.set(symbol, price);
                    updates.push(priceData);
                }
            }

            // Broadcast updates to all connected clients
            if (updates.length > 0) {
                this.broadcast({
                    type: 'price_update',
                    data: updates,
                    timestamp: new Date().toISOString()
                });

                console.log(`📊 Broadcasted ${updates.length} price updates to ${this.clients.size} users`);
            }
        } catch (error) {
            console.error('Error broadcasting price updates:', error);
        }
    }

    /**
     * Fetch prices from MEXC API
     */
    async fetchPricesFromMEXC(symbols) {
        try {
            const prices = [];

            // Batch request to MEXC
            for (const symbol of symbols) {
                try {
                    const response = await axios.get(
                        `https://api.mexc.com/api/v3/ticker/24hr?symbol=${symbol}`,
                        { timeout: 3000 }
                    );

                    if (response.data) {
                        prices.push({
                            symbol,
                            price: parseFloat(response.data.lastPrice || 0),
                            change24h: parseFloat(response.data.priceChangePercent || 0),
                            volume: response.data.volume || '0',
                            high24h: parseFloat(response.data.highPrice || 0),
                            low24h: parseFloat(response.data.lowPrice || 0)
                        });
                    }
                } catch (err) {
                    console.warn(`Failed to fetch price for ${symbol}:`, err.message);
                }
            }

            return prices;
        } catch (error) {
            console.error('MEXC API error:', error);
            return [];
        }
    }

    /**
     * Broadcast message to all connected clients
     */
    broadcast(message) {
        const messageStr = JSON.stringify(message);
        
        this.clients.forEach((connections, userId) => {
            connections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(messageStr);
                }
            });
        });
    }

    /**
     * Broadcast to specific user
     */
    broadcastToUser(userId, message) {
        const connections = this.clients.get(userId);
        if (!connections) return;

        const messageStr = JSON.stringify(message);
        connections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });
    }

    /**
     * Get statistics
     */
    getStats() {
        let totalConnections = 0;
        this.clients.forEach(connections => {
            totalConnections += connections.size;
        });

        return {
            connectedUsers: this.clients.size,
            totalConnections,
            cachedSymbols: this.priceCache.size,
            updateFrequency: this.UPDATE_FREQUENCY
        };
    }

    /**
     * Shutdown service
     */
    shutdown() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        if (this.wss) {
            this.wss.clients.forEach(ws => {
                ws.close();
            });
            this.wss.close();
        }

        console.log('📡 WebSocket service shutdown');
    }
}

// Singleton instance
const favoritesWebSocketService = new FavoritesWebSocketService();

export default favoritesWebSocketService;

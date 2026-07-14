import { useState, useEffect, useRef, useCallback } from 'react';

export interface WebSocketMessage {
    type: 'price_update' | 'alert_triggered' | 'error' | 'connected' | 'pong' | 'agent_update' | string;
    data?: any;
    timestamp?: string;
    payload?: any;
}

export interface WebSocketHookOptions {
    url: string;
    token?: string;
    autoConnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    onMessage?: (message: WebSocketMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
}

export interface WebSocketHookReturn {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    send: (message: any) => void;
    connect: () => void;
    disconnect: () => void;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
}

/**
 * Custom React Hook for WebSocket Connection
 * 
 * @example
 * const { isConnected, send } = useWebSocket({
 *   url: 'ws://localhost:5002/ws/favorites',
 *   token: localStorage.getItem('token'),
 *   onMessage: (message) => console.log('Received:', message)
 * });
 */
export const useWebSocket = (options: WebSocketHookOptions): WebSocketHookReturn => {
    const {
        url,
        token,
        autoConnect = true,
        reconnectInterval = 3000,
        maxReconnectAttempts = 5,
        onMessage,
        onConnect,
        onDisconnect,
        onError,
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);

    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
    const shouldReconnect = useRef(true);

    /**
     * Send message to WebSocket server
     */
    const send = useCallback((message: any) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(message));
            console.log('📤 WebSocket sent:', message);
        } else {
            console.warn('⚠️ WebSocket not connected. Cannot send message:', message);
        }
    }, []);

    /**
     * Start heartbeat (ping/pong) to keep connection alive
     */
    const startHeartbeat = useCallback(() => {
        heartbeatInterval.current = setInterval(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                send({ type: 'ping' });
            }
        }, 30000); // Send ping every 30 seconds
    }, [send]);

    /**
     * Stop heartbeat
     */
    const stopHeartbeat = useCallback(() => {
        if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = null;
        }
    }, []);

    /**
     * Connect to WebSocket server
     */
    const connect = useCallback(() => {
        if (ws.current?.readyState === WebSocket.OPEN || isConnecting) {
            console.log('🔗 WebSocket already connected or connecting');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const wsUrl = token ? `${url}?token=${token}` : url;
            console.log('🔗 Connecting to WebSocket:', wsUrl.replace(token || '', '***'));
            
            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = () => {
                console.log('✅ WebSocket connected successfully');
                setIsConnected(true);
                setIsConnecting(false);
                setError(null);
                setReconnectAttempts(0);
                startHeartbeat();
                onConnect?.();
            };

            ws.current.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    console.log('📥 WebSocket received:', message);
                    onMessage?.(message);
                } catch (err) {
                    console.error('❌ Failed to parse WebSocket message:', err);
                }
            };

            ws.current.onerror = (event) => {
                setError('WebSocket connection error');
                setIsConnecting(false);
                onError?.(event);
            };

            ws.current.onclose = (event) => {
                setIsConnected(false);
                setIsConnecting(false);
                stopHeartbeat();
                ws.current = null;
                onDisconnect?.();

                // Attempt limited reconnection (quiet)
                if (shouldReconnect.current && reconnectAttempts < maxReconnectAttempts) {
                    reconnectTimeout.current = setTimeout(() => {
                        setReconnectAttempts(prev => prev + 1);
                        connect();
                    }, reconnectInterval);
                } else if (reconnectAttempts >= maxReconnectAttempts) {
                    shouldReconnect.current = false;
                    setError('realtime_unavailable');
                }
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect');
            setIsConnecting(false);
        }
    }, [url, token, reconnectAttempts, maxReconnectAttempts, reconnectInterval, isConnecting, onMessage, onConnect, onDisconnect, onError, startHeartbeat, stopHeartbeat, send]);

    /**
     * Disconnect from WebSocket server
     */
    const disconnect = useCallback(() => {
        console.log('🔌 Disconnecting WebSocket...');
        shouldReconnect.current = false;
        
        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = null;
        }
        
        stopHeartbeat();
        
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }
        
        setIsConnected(false);
        setIsConnecting(false);
    }, [stopHeartbeat]);

    /**
     * Auto-connect on mount
     */
    useEffect(() => {
        if (autoConnect) {
            connect();
        }

        // Cleanup on unmount
        return () => {
            shouldReconnect.current = false;
            disconnect();
        };
    }, [autoConnect]); // Only run on mount and unmount

    return {
        isConnected,
        isConnecting,
        error,
        send,
        connect,
        disconnect,
        reconnectAttempts,
        maxReconnectAttempts,
    };
};

export default useWebSocket;

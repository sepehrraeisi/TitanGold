import { useState, useEffect, useRef, useCallback } from 'react';
import { redactSensitiveText, redactSensitiveUrl } from '../utils/redactSensitive.ts';

export interface WebSocketMessage {
    type: 'price_update' | 'alert_triggered' | 'error' | 'connected' | 'pong' | 'agent_update' | 'auth_required' | string;
    data?: any;
    timestamp?: string;
    payload?: any;
    token?: string;
    code?: string;
    message?: string;
}

export interface WebSocketHookOptions {
    url: string;
    token?: string;
    autoConnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    quiet?: boolean;
    onMessage?: (message: WebSocketMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
}

export interface WebSocketHookReturn {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    realtimeUnavailable: boolean;
    send: (message: any) => void;
    connect: (opts?: { force?: boolean }) => void;
    disconnect: () => void;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
}

function safeLog(quiet: boolean, level: 'log' | 'warn' | 'error', ...args: unknown[]) {
    if (quiet && level === 'log') return;
    const cleaned = args.map((a) => {
        if (typeof a === 'string') return redactSensitiveText(a);
        if (a && typeof a === 'object') {
            try {
                return JSON.parse(redactSensitiveText(JSON.stringify(a)));
            } catch {
                return '[object]';
            }
        }
        return a;
    });
    // eslint-disable-next-line no-console
    console[level](...cleaned);
}

/**
 * Stable WebSocket hook — token never in URL; bounded backoff; sticky unavailable.
 */
export const useWebSocket = (options: WebSocketHookOptions): WebSocketHookReturn => {
    const {
        url,
        token,
        autoConnect = true,
        reconnectInterval = 3000,
        maxReconnectAttempts = 3,
        quiet = true,
        onMessage,
        onConnect,
        onDisconnect,
        onError,
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [realtimeUnavailable, setRealtimeUnavailable] = useState(false);

    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const shouldReconnect = useRef(true);
    const attemptRef = useRef(0);
    const connectingRef = useRef(false);
    const unavailableRef = useRef(false);
    const unmountedRef = useRef(false);
    const connectSeq = useRef(0);

    const urlRef = useRef(url);
    const tokenRef = useRef(token);
    const maxAttemptsRef = useRef(maxReconnectAttempts);
    const baseIntervalRef = useRef(reconnectInterval);
    const quietRef = useRef(quiet);
    const onMessageRef = useRef(onMessage);
    const onConnectRef = useRef(onConnect);
    const onDisconnectRef = useRef(onDisconnect);
    const onErrorRef = useRef(onError);

    urlRef.current = url;
    tokenRef.current = token;
    maxAttemptsRef.current = maxReconnectAttempts;
    baseIntervalRef.current = reconnectInterval;
    quietRef.current = quiet;
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;

    const clearReconnectTimer = () => {
        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = null;
        }
    };

    const stopHeartbeat = () => {
        if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = null;
        }
    };

    const startHeartbeat = () => {
        stopHeartbeat();
        heartbeatInterval.current = setInterval(() => {
            if (ws.current?.readyState === WebSocket.OPEN) {
                try {
                    ws.current.send(JSON.stringify({ type: 'ping' }));
                } catch {
                    // ignore
                }
            }
        }, 30000);
    };

    const markUnavailable = (reason = 'realtime_unavailable') => {
        unavailableRef.current = true;
        shouldReconnect.current = false;
        clearReconnectTimer();
        connectingRef.current = false;
        if (!unmountedRef.current) {
            setRealtimeUnavailable(true);
            setError(reason);
            setIsConnecting(false);
        }
    };

    const connectInternal = useCallback(() => {
        if (unmountedRef.current) return;
        if (ws.current?.readyState === WebSocket.OPEN || connectingRef.current) return;
        if (unavailableRef.current) return;

        const seq = ++connectSeq.current;
        connectingRef.current = true;
        if (!unmountedRef.current) {
            setIsConnecting(true);
            setError(null);
        }

        try {
            const wsUrl = urlRef.current;
            safeLog(quietRef.current, 'log', '🔗 Connecting to WebSocket:', redactSensitiveUrl(wsUrl));
            const socket = new WebSocket(wsUrl);
            ws.current = socket;

            socket.onopen = () => {
                if (seq !== connectSeq.current) return;
                const authToken = tokenRef.current;
                if (authToken) {
                    try {
                        socket.send(JSON.stringify({ type: 'auth', token: authToken }));
                    } catch {
                        // ignore
                    }
                }
                connectingRef.current = false;
                if (!unmountedRef.current) {
                    setIsConnected(true);
                    setIsConnecting(false);
                    setError(null);
                    attemptRef.current = 0;
                    setReconnectAttempts(0);
                    unavailableRef.current = false;
                    setRealtimeUnavailable(false);
                }
                startHeartbeat();
                onConnectRef.current?.();
            };

            socket.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    if (message.type === 'error' && (message.code === 'AUTH_FAILED' || message.code === 'AUTH_REQUIRED')) {
                        // AUTH_REQUIRED before auth message is expected — ignore once.
                        if (message.code === 'AUTH_REQUIRED' && tokenRef.current) return;
                        safeLog(quietRef.current, 'warn', 'WebSocket auth rejected:', message.code);
                        shouldReconnect.current = false;
                        markUnavailable(message.code === 'AUTH_FAILED' ? 'auth_failed' : 'auth_required');
                        try { socket.close(1008, 'auth'); } catch { /* ignore */ }
                        return;
                    }
                    onMessageRef.current?.(message);
                } catch (err) {
                    safeLog(quietRef.current, 'error', '❌ Failed to parse WebSocket message');
                }
            };

            socket.onerror = (event) => {
                onErrorRef.current?.(event);
            };

            socket.onclose = () => {
                if (ws.current === socket) ws.current = null;
                connectingRef.current = false;
                stopHeartbeat();
                if (!unmountedRef.current) {
                    setIsConnected(false);
                    setIsConnecting(false);
                }
                onDisconnectRef.current?.();

                if (!shouldReconnect.current || unavailableRef.current || unmountedRef.current) {
                    if (!shouldReconnect.current && !unavailableRef.current && attemptRef.current >= maxAttemptsRef.current) {
                        markUnavailable();
                    }
                    return;
                }

                if (attemptRef.current >= maxAttemptsRef.current) {
                    markUnavailable();
                    return;
                }

                const delay = Math.min(
                    baseIntervalRef.current * Math.pow(2, attemptRef.current),
                    30000,
                );
                attemptRef.current += 1;
                if (!unmountedRef.current) {
                    setReconnectAttempts(attemptRef.current);
                }
                clearReconnectTimer();
                reconnectTimeout.current = setTimeout(() => {
                    connectInternal();
                }, delay);
            };
        } catch (err) {
            connectingRef.current = false;
            const msg = err instanceof Error ? err.message : 'Failed to connect';
            if (!unmountedRef.current) {
                setError(redactSensitiveText(msg));
                setIsConnecting(false);
            }
            if (attemptRef.current >= maxAttemptsRef.current) {
                markUnavailable();
            } else {
                attemptRef.current += 1;
                clearReconnectTimer();
                reconnectTimeout.current = setTimeout(() => connectInternal(), baseIntervalRef.current);
            }
        }
    }, []);

    const connect = useCallback((opts?: { force?: boolean }) => {
        if (opts?.force) {
            unavailableRef.current = false;
            shouldReconnect.current = true;
            attemptRef.current = 0;
            clearReconnectTimer();
            if (!unmountedRef.current) {
                setRealtimeUnavailable(false);
                setReconnectAttempts(0);
                setError(null);
            }
            if (ws.current) {
                try { ws.current.close(); } catch { /* ignore */ }
                ws.current = null;
            }
            connectingRef.current = false;
        }
        connectInternal();
    }, [connectInternal]);

    const disconnect = useCallback(() => {
        shouldReconnect.current = false;
        clearReconnectTimer();
        stopHeartbeat();
        if (ws.current) {
            try { ws.current.close(); } catch { /* ignore */ }
            ws.current = null;
        }
        connectingRef.current = false;
        if (!unmountedRef.current) {
            setIsConnected(false);
            setIsConnecting(false);
        }
    }, []);

    const send = useCallback((message: any) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            // Strip token from any accidental log path — send payload as-is to server only.
            ws.current.send(JSON.stringify(message));
        }
    }, []);

    useEffect(() => {
        unmountedRef.current = false;
        shouldReconnect.current = true;
        unavailableRef.current = false;
        attemptRef.current = 0;
        if (autoConnect) {
            connectInternal();
        }
        return () => {
            unmountedRef.current = true;
            shouldReconnect.current = false;
            clearReconnectTimer();
            stopHeartbeat();
            if (ws.current) {
                try { ws.current.close(); } catch { /* ignore */ }
                ws.current = null;
            }
            connectingRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoConnect, url]);

    return {
        isConnected,
        isConnecting,
        error,
        realtimeUnavailable,
        send,
        connect,
        disconnect,
        reconnectAttempts,
        maxReconnectAttempts,
    };
};

export default useWebSocket;

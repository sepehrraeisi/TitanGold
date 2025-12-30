/**
 * Backend API Service for Server-Side Data
 * 
 * This module handles API calls to backend endpoints that fetch data
 * from the database (as opposed to IndexedDB/localStorage).
 */

import type { ArtemisLog, ArtemisLogFilter, SystemError } from '../types';

/**
 * Get authentication headers for API requests
 * 
 * Retrieves the titan_token from localStorage or sessionStorage
 * and constructs the Authorization header.
 * 
 * @returns Headers object with Authorization if token exists
 */
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('titan_token') || sessionStorage.getItem('titan_token');
  
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Fetch Artemis logs from backend server (not IndexedDB)
 * 
 * This is the production-ready version that fetches real-time logs
 * from the backend database (system_logs + ai_decisions tables).
 * 
 * Backend endpoint: GET /api/artemis/logs
 * Query params: limit, offset, level, category
 * 
 * Response format:
 * {
 *   systemLogs: Array<{ id, level, category, message, metadata, created_at }>,
 *   decisions: Array<{ id, agent_id, input, output, was_successful, confidence, created_at }>,
 *   total: number
 * }
 * 
 * @param filter - Filter options for logs
 * @returns Array of ArtemisLog objects from backend
 */
export const fetchArtemisLogsFromServer = async (
  filter: ArtemisLogFilter = {}
): Promise<ArtemisLog[]> => {
  try {
    const params = new URLSearchParams();

    // Map filter params to backend query params
    if (filter.limit) {
      params.set('limit', String(filter.limit));
    }

    if (filter.level && filter.level !== 'all') {
      params.set('level', filter.level);
    }

    // Backend expects 'category' but frontend uses 'filter' for log type
    if (filter.filter && filter.filter !== 'all') {
      params.set('category', filter.filter);
    }

    const url = `/api/artemis/logs${params.toString() ? `?${params.toString()}` : ''}`;

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(
        `fetchArtemisLogsFromServer failed: ${res.status} ${errorText}`
      );
    }

    const data = await res.json();

    // Backend returns: { systemLogs: [...], decisions: [...], total: number }
    // Transform to ArtemisLog[] format expected by UI
    const logs: ArtemisLog[] = [];

    // Transform system_logs
    if (data.systemLogs && Array.isArray(data.systemLogs)) {
      data.systemLogs.forEach((log: any) => {
        logs.push({
          id: log.id || String(Date.now() + Math.random()),
          timestamp: log.created_at || new Date().toISOString(),
          type: (log.category?.includes('decision') ? 'decision' : 'system') as any,
          level: log.level || 'info',
          source: 'system',
          action: log.message || 'Log entry',
          details: log.metadata || {},
        });
      });
    }

    // Transform ai_decisions
    if (data.decisions && Array.isArray(data.decisions)) {
      data.decisions.forEach((decision: any) => {
        logs.push({
          id: decision.id || String(Date.now() + Math.random()),
          timestamp: decision.created_at || new Date().toISOString(),
          type: 'decision',
          level: decision.was_successful ? 'info' : 'error',
          source: 'agent',
          action: `Agent decision (confidence: ${decision.confidence || 0}%)`,
          details: {
            agentId: decision.agent_id,
            input: decision.input,
            output: decision.output,
            confidence: decision.confidence,
            wasSuccessful: decision.was_successful,
          },
          agentId: decision.agent_id,
          result: decision.was_successful ? 'success' : 'failed',
        });
      });
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return logs;
  } catch (error) {
    console.error('Failed to fetch Artemis logs from server:', error);
    throw error; // Throw instead of returning [] so UI can show error
  }
};

/**
 * Fetch system error logs from monitoring endpoint
 * 
 * Backend endpoint: GET /api/monitoring/errors
 * Query params: limit (max: 200)
 * 
 * Response format:
 * {
 *   success: boolean,
 *   errors: Array<{ id, context, message, stack, meta, timestamp }>
 * }
 * 
 * @param limit - Maximum number of errors to fetch (default: 50, max: 200)
 * @returns Array of error log objects
 */
export const fetchSystemErrors = async (limit: number = 50): Promise<SystemError[]> => {
  try {
    const params = new URLSearchParams();
    params.set('limit', String(Math.min(limit, 200)));

    const url = `/api/monitoring/errors?${params.toString()}`;

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('Admin access required to view system errors');
      }
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`fetchSystemErrors failed: ${res.status} ${errorText}`);
    }

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch system errors');
    }

    return data.errors || [];
  } catch (error) {
    console.error('Failed to fetch system errors:', error);
    throw error;
  }
};

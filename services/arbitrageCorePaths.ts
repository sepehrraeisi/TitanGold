/** Canonical arbitrage core API path (versioned — no legacy /api redirect). */
export function buildArbitrageCoreApiPath(agentId: string, path: string): string {
  return `/api/v1/ai-agents/${agentId}/arbitrage/${path}`;
}

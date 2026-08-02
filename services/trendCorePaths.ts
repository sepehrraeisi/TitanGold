/** Canonical Trend core API path (versioned). */
export function buildTrendCoreApiPath(agentId: string, path: string): string {
  return `/api/v1/ai-agents/${agentId}/trend/${path}`;
}

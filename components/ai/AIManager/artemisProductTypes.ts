import type { ExecutionRuntimeView } from '../../services/executionRuntimeApi.ts';
import type { OnNavigateHandler, NavigationPayload } from '../../../types/navigation.ts';
import type { ArtemisPresentationMode } from './artemisPresentation.ts';

export type ArtemisSectionId =
  | 'overview'
  | 'evidence'
  | 'decisions'
  | 'orchestration'
  | 'controls'
  | 'lineage'
  | 'system'
  | 'legacy_admin';

export type TruthClass =
  | 'MEASURED'
  | 'PERSISTED'
  | 'DERIVED'
  | 'CONFIGURED'
  | 'LEGACY'
  | 'UNAVAILABLE';

export type ArtemisCatalogAgent = {
  key: string;
  registryKey: string;
  nameKey: string;
  group: string;
  authority: string;
  readiness: string;
  operational: string;
  exists: boolean;
  operationalNow: boolean;
  evidenceCompatible: boolean;
  evidenceAvailable: boolean;
  consumption: string;
  inventoryId?: string | null;
  inventoryName?: string | null;
  inventoryStatus?: string | null;
  limitationKey?: string | null;
  truth: TruthClass | string;
};

export type ArtemisAuditLog = {
  id?: string | number | null;
  level?: string | null;
  classification?: string | null;
  created_at?: string | null;
  timestamp?: string | null;
  action?: string | null;
  symbol?: string | null;
  message?: string | null;
  reason?: string | null;
  executionEligible?: boolean;
  advisoryOnly?: boolean;
};

export type ArtemisAgentRun = {
  id?: string;
  agentId?: string;
  agentKey?: string | null;
  agentName?: string | null;
  successful?: boolean;
  recordedScore?: number | null;
  createdAt?: string | null;
  symbol?: string | null;
  action?: string | null;
};

export type ArtemisAuditBundle = {
  systemLogs: ArtemisAuditLog[];
  decisions: ArtemisAgentRun[];
  loadFailed?: boolean;
  limit?: number;
  advisoryTotal?: number | null;
  agentRunTotal?: number | null;
};

export type ArtemisReadiness = {
  maturityStage: string;
  classification: string;
  executionEligible: boolean;
  executionEligibility: string;
  contract: {
    schemaVersion: string;
    contractVersion: string;
    readiness: string;
    implemented: boolean;
    adaptersRequired?: boolean;
    compatibleAgentCount?: number;
    catalogAgentCount?: number;
    truth: TruthClass;
  };
  evidence: { readiness: string; reasonKey?: string; truth: TruthClass };
  orchestration: {
    readiness: string;
    realAgentCoordination: boolean;
    reasonKey?: string;
    truth: TruthClass;
  };
  controlChain: Record<
    string,
    {
      authority: string;
      readiness: string;
      truth: TruthClass;
      limitationKey?: string;
      ownerNav?: NavigationPayload;
    }
  >;
  runtime: (ExecutionRuntimeView & { connectionCount?: number | null }) | null;
  runtimeTruth: TruthClass;
  agents: Record<string, { keys: string[]; readiness: string; limitationKey?: string }>;
  catalog?: {
    truth: TruthClass | string;
    groups?: { id: string; labelKey: string; authority: string }[];
    agents?: ArtemisCatalogAgent[];
  };
  inventory?: {
    truth: TruthClass | string;
    agents?: Array<{
      id: string;
      agentKey?: string | null;
      name?: string | null;
      type?: string | null;
      status?: string | null;
      enabled?: boolean;
    }>;
    configuredCount?: number | null;
    operationalCount?: number | null;
  };
  providers?: {
    truth: TruthClass | string;
    ready?: boolean | null;
    configured?: number | null;
    healthy?: number | null;
    activeHealthy?: number | null;
    activeUsableInstances?: number | null;
    quorum?: number | null;
    items?: Array<{
      id: string;
      healthyKeys: number;
      enabledKeys: number;
      totalKeys: number;
      ok: boolean;
    }>;
  };
  connections?: {
    truth: TruthClass | string;
    providerConnected?: boolean | null;
    count?: number | null;
    status?: string;
  };
  dataHub?: {
    truth: TruthClass | string;
    totalSources?: number | null;
    activeSources?: number | null;
    status?: string;
  };
  scheduler?: {
    truth: TruthClass | string;
    allowlist?: string[];
    agentsEnabled?: boolean | null;
    isRunning?: boolean | null;
    stale?: boolean;
    owner?: string | null;
    lastTickAt?: string | null;
  };
  advisory?: {
    truth: TruthClass | string;
    count?: number | null;
    latestAt?: string | null;
    recent?: ArtemisAuditLog[];
    limit?: number;
    loadedCount?: number;
    detailsAvailable?: boolean;
  };
  agentRuns?: {
    truth: TruthClass | string;
    count?: number | null;
    latestAt?: string | null;
    recent?: ArtemisAgentRun[];
    limit?: number;
    loadedCount?: number;
    detailsAvailable?: boolean;
  };
  provenance?: { truth: TruthClass | string; runtimeCommit?: string | null };
  pipeline?: Array<{
    id: string;
    labelKey: string;
    ownerKey: string;
    status: string;
    truth: TruthClass | string;
    nav?: NavigationPayload & { artemisSection?: string };
    blockerKey?: string | null;
  }>;
  blockers?: Array<{ code: string; severity: string; labelKey: string }>;
  owners?: Record<string, NavigationPayload>;
  limitations: string[];
  dualConfigLimitationKey?: string;
  generatedAt: string;
};

export type ArtemisSectionProps = {
  t: (key: string, options?: { [key: string]: string | number }) => string;
  language?: string;
  readiness: ArtemisReadiness | null;
  readinessError?: string | null;
  onNavigate?: OnNavigateHandler;
  audit?: ArtemisAuditBundle;
  onOpenSection?: (id: ArtemisSectionId) => void;
  presentation?: ArtemisPresentationMode;
  onRetry?: () => void;
};

export const CANONICAL_SECTIONS: { id: Exclude<ArtemisSectionId, 'legacy_admin'>; labelKey: string; fallback: string }[] = [
  { id: 'overview', labelKey: 'artemis_nav_overview', fallback: 'Home' },
  { id: 'evidence', labelKey: 'artemis_nav_evidence', fallback: 'AI Inputs' },
  { id: 'decisions', labelKey: 'artemis_nav_decisions', fallback: 'Recommendations' },
  { id: 'orchestration', labelKey: 'artemis_nav_orchestration', fallback: 'Coordination' },
  { id: 'controls', labelKey: 'artemis_nav_controls', fallback: 'Safety & Approval' },
  { id: 'lineage', labelKey: 'artemis_nav_lineage', fallback: 'History & Audit' },
  { id: 'system', labelKey: 'artemis_nav_system', fallback: 'System Health' },
];

export function truthLabel(truth: TruthClass | string | undefined, t: (k: string) => string): string {
  switch (truth) {
    case 'MEASURED':
      return t('artemis_truth_measured') !== 'artemis_truth_measured' ? t('artemis_truth_measured') : 'Measured';
    case 'PERSISTED':
      return t('artemis_truth_persisted') !== 'artemis_truth_persisted' ? t('artemis_truth_persisted') : 'Persisted';
    case 'DERIVED':
      return t('artemis_truth_derived') !== 'artemis_truth_derived' ? t('artemis_truth_derived') : 'Derived';
    case 'CONFIGURED':
      return t('artemis_truth_configured') !== 'artemis_truth_configured' ? t('artemis_truth_configured') : 'Configured';
    case 'LEGACY':
      return t('artemis_truth_legacy') !== 'artemis_truth_legacy' ? t('artemis_truth_legacy') : 'Legacy';
    default:
      return t('artemis_truth_unavailable') !== 'artemis_truth_unavailable' ? t('artemis_truth_unavailable') : 'Unavailable';
  }
}

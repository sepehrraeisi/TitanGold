import type { ExecutionRuntimeView } from '../../services/executionRuntimeApi.ts';

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
    { authority: string; readiness: string; truth: TruthClass; limitationKey?: string }
  >;
  runtime: ExecutionRuntimeView | null;
  runtimeTruth: TruthClass;
  agents: Record<string, { keys: string[]; readiness: string; limitationKey?: string }>;
  limitations: string[];
  dualConfigLimitationKey?: string;
  generatedAt: string;
};

export const CANONICAL_SECTIONS: { id: ArtemisSectionId; labelKey: string; fallback: string }[] = [
  { id: 'overview', labelKey: 'artemis_nav_overview', fallback: 'Overview' },
  { id: 'evidence', labelKey: 'artemis_nav_evidence', fallback: 'Evidence' },
  { id: 'decisions', labelKey: 'artemis_nav_decisions', fallback: 'Decisions' },
  { id: 'orchestration', labelKey: 'artemis_nav_orchestration', fallback: 'Orchestration' },
  { id: 'controls', labelKey: 'artemis_nav_controls', fallback: 'Controls' },
  { id: 'lineage', labelKey: 'artemis_nav_lineage', fallback: 'Lineage & Audit' },
  { id: 'system', labelKey: 'artemis_nav_system', fallback: 'System & Integrations' },
];

export function truthLabel(truth: TruthClass | string | undefined, t: (k: string) => string): string {
  switch (truth) {
    case 'MEASURED':
      return t('artemis_truth_measured') || 'Measured';
    case 'PERSISTED':
      return t('artemis_truth_persisted') || 'Persisted';
    case 'DERIVED':
      return t('artemis_truth_derived') || 'Derived';
    case 'CONFIGURED':
      return t('artemis_truth_configured') || 'Configured';
    case 'LEGACY':
      return t('artemis_truth_legacy') || 'Legacy';
    default:
      return t('artemis_truth_unavailable') || 'Unavailable';
  }
}

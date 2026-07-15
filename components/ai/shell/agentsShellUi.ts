/**
 * Agents Shell design tokens — reuse Data Hub / Telegram Collector language.
 * Do not invent a parallel design system.
 */
export {
  DATAHUB_SHELL,
  DATAHUB_INNER_LIST,
  INPUT_CLASS,
  SELECT_CLASS,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_OUTLINE_AMBER,
  BTN_OUTLINE_RED,
  StatusPill,
  MetricCard,
  DataHubAlert,
  DataHubEmpty,
} from '../AIManager/tabs/DataHub/dataHubUi.tsx';

/** First-level agent card shell — DESIGN_SYSTEM_DATAHUB.md §5 */
export const AGENT_CARD_SHELL =
  'bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg rounded-xl p-4 flex flex-col gap-3 h-full transition-colors hover:border-white/10 focus-within:border-purple-500/40';

/** Compact safety summary — same slate gradient language, denser padding */
export const AGENT_SAFETY_SHELL =
  'bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 rounded-xl px-3 py-2.5 md:px-4';

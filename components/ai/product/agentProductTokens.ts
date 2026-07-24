/**
 * Agent Product Template V1 — layout contract (reuse Data Hub tokens).
 * Single source for popup dimensions, gutters, surfaces, and responsive behavior.
 */

export const AGENT_PRODUCT_SURFACES = {
  /** Dialog outer shell */
  dialogShell:
    'bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 border border-white/5',
  /** Header / toolbar chrome */
  headerChrome: 'bg-slate-950/95',
  toolbarChrome: 'bg-slate-950/60',
  /** Scrollable main canvas */
  contentCanvas: 'bg-slate-950/40',
  /** Section cards inside content */
  sectionCard:
    'bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg rounded-xl',
  /** Compact list rows (recent activity) */
  listRow: 'bg-slate-950/70 border border-white/5 rounded-lg',
  /** Safety / warning strip — semantic, not dominant */
  safetySurface: 'bg-amber-500/5 border-b border-amber-500/15',
  /** Canonical subtle divider — never pure white */
  divider: 'border-white/5',
  /** Status grid item */
  statusItem: 'bg-slate-950/70 border border-white/5 rounded-lg',
} as const;

export const AGENT_PRODUCT_TOKENS = {
  dialogMaxWidth: 'max-w-6xl',
  dialogMaxHeight: 'max-h-[min(92vh,100dvh-1.5rem)]',
  dialogRadius: 'rounded-xl',
  overlay:
    'fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4',
  mobileFullScreen:
    'w-full h-[100dvh] sm:h-auto sm:max-h-[min(92vh,100dvh-1.5rem)] rounded-none sm:rounded-xl',
  headerPadding: 'px-4 sm:px-6 py-4',
  contentGutter: 'px-4 sm:px-6',
  sectionGap: 'space-y-5',
  cardPadding: 'p-4 md:p-5',
  cardRadius: 'rounded-xl',
  titleLg: 'text-lg sm:text-xl font-bold',
  titleMd: 'text-sm font-semibold',
  labelSm: 'text-[11px] uppercase tracking-wide text-muted-foreground',
  metricValue: 'text-xl font-semibold',
  actionMinHeight: 'min-h-[2.25rem]',
  statusItemMinHeight: 'min-h-[3.25rem]',
  navGap: 'gap-2',
  scrollOwner: 'flex-1 min-h-0 overflow-y-auto overscroll-contain',
  surfaces: AGENT_PRODUCT_SURFACES,
} as const;

export type AgentProductTokens = typeof AGENT_PRODUCT_TOKENS;

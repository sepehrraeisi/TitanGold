/**
 * Agent Product Template V1 — layout contract (reuse Data Hub tokens).
 * Single source for popup dimensions, gutters, and responsive behavior.
 */

export const AGENT_PRODUCT_TOKENS = {
  dialogMaxWidth: 'max-w-6xl',
  dialogMaxHeight: 'max-h-[min(92vh,100dvh-1.5rem)]',
  dialogRadius: 'rounded-xl',
  dialogBorder: 'border border-border',
  dialogBg: 'bg-[#12161c]',
  overlay: 'fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4',
  mobileFullScreen: 'w-full h-[100dvh] sm:h-auto sm:max-h-[min(92vh,100dvh-1.5rem)] rounded-none sm:rounded-xl',
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
  navGap: 'gap-2',
  scrollOwner: 'flex-1 min-h-0 overflow-y-auto overscroll-contain',
} as const;

export type AgentProductTokens = typeof AGENT_PRODUCT_TOKENS;

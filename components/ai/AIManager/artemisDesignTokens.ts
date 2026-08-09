/**
 * Artemis visual tokens — same rules as DESIGN_SYSTEM_DATAHUB.md / Telegram Collector.
 * Duplicated here so Artemis does not import Data Hub business modules.
 */

export const ARTEMIS_FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950';

export const ARTEMIS_SHELL =
  'bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 border border-white/5 shadow-lg rounded-xl p-4 md:p-5 backdrop-blur-sm';

export const ARTEMIS_INNER =
  'bg-slate-950/70 border border-white/5 rounded-xl p-3 md:p-4';

export const ARTEMIS_ROW =
  'bg-slate-900/60 border border-white/5 rounded-lg p-3 text-xs';

export const ARTEMIS_TECH =
  'bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 font-mono text-[10px] text-muted-foreground';

export const ARTEMIS_TAB_STRIP =
  'border border-white/5 bg-slate-950/70 rounded-xl p-2 overflow-x-auto no-scrollbar';

export const ARTEMIS_TAB_ITEM =
  `px-3 py-1.5 rounded-full text-xs font-medium border border-white/5 bg-slate-900/60 text-muted-foreground hover:bg-slate-900/90 hover:text-foreground transition-colors whitespace-nowrap ${ARTEMIS_FOCUS}`;

export const ARTEMIS_TAB_ACTIVE = 'bg-purple-600/20 border-purple-500/60 text-purple-300';

export const ARTEMIS_BTN_PRIMARY =
  `inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${ARTEMIS_FOCUS}`;

export const ARTEMIS_BTN_SECONDARY =
  `inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${ARTEMIS_FOCUS}`;

export const ARTEMIS_BTN_OUTLINE =
  `inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-medium border border-sky-400/70 text-sky-200 hover:bg-sky-500/10 disabled:opacity-50 disabled:cursor-not-allowed ${ARTEMIS_FOCUS}`;

export const ARTEMIS_BTN_TEXT =
  `inline-flex items-center text-[10px] font-medium text-sky-300 hover:text-sky-200 ${ARTEMIS_FOCUS} rounded`;

export const ARTEMIS_BTN_MODAL_CLOSE =
  `text-[11px] bg-slate-700 hover:bg-slate-600 text-white rounded px-3 py-1.5 ${ARTEMIS_FOCUS}`;

export const ARTEMIS_INPUT =
  `w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-foreground ${ARTEMIS_FOCUS}`;

export const ARTEMIS_SELECT =
  `w-full text-[11px] bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-foreground ${ARTEMIS_FOCUS}`;

export const ARTEMIS_TABLE_WRAP = 'overflow-x-auto -mx-1 md:-mx-3 mt-2';
export const ARTEMIS_TABLE = 'min-w-full text-xs text-foreground/90';
export const ARTEMIS_THEAD = 'border-b border-slate-800 text-[11px] text-muted-foreground';
export const ARTEMIS_TH = 'px-3 py-2 text-start';
export const ARTEMIS_TR = 'border-b border-slate-900/60 last:border-0';
export const ARTEMIS_TD = 'px-3 py-2 align-top';

export type ArtemisPillVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'primary';
export type ArtemisMetricColor = 'emerald' | 'blue' | 'purple' | 'amber' | 'red';
export type ArtemisTone = 'neutral' | 'warning' | 'danger' | 'info' | 'ok' | 'primary';

export const PILL_CLASS: Record<ArtemisPillVariant, string> = {
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  error: 'bg-red-500/10 text-red-300 border-red-500/40',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
  info: 'bg-blue-500/10 text-blue-300 border-blue-500/40',
  neutral: 'bg-slate-700 text-slate-300 border-slate-600',
  primary: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
};

export const METRIC_GRADIENT: Record<ArtemisMetricColor, string> = {
  emerald: 'from-emerald-500/10 via-emerald-500/5',
  blue: 'from-blue-500/10 via-blue-500/5',
  purple: 'from-purple-500/10 via-purple-500/5',
  amber: 'from-amber-500/10 via-amber-500/5',
  red: 'from-red-500/10 via-red-500/5',
};

export const METRIC_LABEL: Record<ArtemisMetricColor, string> = {
  emerald: 'text-emerald-300/80',
  blue: 'text-blue-300/80',
  purple: 'text-purple-300/80',
  amber: 'text-amber-300/80',
  red: 'text-red-300/80',
};

export const METRIC_VALUE: Record<ArtemisMetricColor, string> = {
  emerald: 'text-emerald-100',
  blue: 'text-blue-100',
  purple: 'text-purple-100',
  amber: 'text-amber-100',
  red: 'text-red-100',
};

export function toneToVariant(tone?: ArtemisTone | string | null): ArtemisPillVariant {
  switch (tone) {
    case 'ok':
    case 'success':
      return 'success';
    case 'danger':
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    case 'primary':
      return 'primary';
    default:
      return 'neutral';
  }
}

export function toneToMetric(tone?: ArtemisTone | string | null): ArtemisMetricColor {
  switch (tone) {
    case 'ok':
    case 'success':
      return 'emerald';
    case 'danger':
    case 'error':
      return 'red';
    case 'warning':
      return 'amber';
    case 'primary':
      return 'purple';
    default:
      return 'blue';
  }
}

import React from 'react';
import { FOCUS_RING } from '../AIManager/tabs/DataHub/dataHubUi.tsx';
import { AGENT_PRODUCT_TOKENS } from './agentProductTokens.ts';

export type AgentSectionTab = {
  id: string;
  label: string;
};

/** Section tabs — single subtle divider below navigation (not above). */
export const AgentSectionNavigation: React.FC<{
  tabs: AgentSectionTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  ariaLabel: string;
  testId?: string;
  idPrefix?: string;
}> = ({ tabs, activeTab, onTabChange, ariaLabel, testId = 'agent-section-nav', idPrefix = 'agent' }) => (
  <div
    className={`${AGENT_PRODUCT_TOKENS.contentGutter} shrink-0 pb-3 border-b ${AGENT_PRODUCT_TOKENS.surfaces.divider}`}
    data-testid={testId}
  >
    <div
      className={`flex flex-nowrap sm:flex-wrap ${AGENT_PRODUCT_TOKENS.navGap} overflow-x-auto overscroll-x-contain`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map(tab => {
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            data-testid={`${idPrefix}-tab-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap ${FOCUS_RING} ${
              selected
                ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                : 'border-white/5 bg-slate-950/70 text-slate-300 hover:border-purple-400/40'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  </div>
);

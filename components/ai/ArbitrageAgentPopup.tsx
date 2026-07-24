import React, { useRef } from 'react';
import type { AIAgent } from '../../types.ts';
import type { ArbitrageAgentSection, OnNavigateHandler } from '../../types/navigation.ts';
import AgentControlShell from './shell/AgentControlShell.tsx';
import ArbitrageWorkspace from './ArbitrageWorkspace.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

export interface ArbitrageAgentPopupProps {
    agent: AIAgent;
    initialSection?: ArbitrageAgentSection;
    initialRunId?: string;
    onClose: () => void;
    onNavigate?: OnNavigateHandler;
    onUpdate: (agent: AIAgent) => void;
    returnFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Route-owned modal popup — Agents list remains visible behind the overlay.
 */
const ArbitrageAgentPopup: React.FC<ArbitrageAgentPopupProps> = ({
    agent,
    initialSection = 'overview',
    initialRunId,
    onClose,
    onNavigate,
    onUpdate,
    returnFocusRef,
}) => {
    const { t } = useLanguage();
    const closeRef = useRef<HTMLButtonElement>(null);

    const handleClose = () => {
        onClose();
        window.requestAnimationFrame(() => {
            returnFocusRef?.current?.focus?.();
        });
    };

    return (
        <AgentControlShell
            agent={agent}
            onClose={handleClose}
            closeTestId="arb-popup-close"
            purpose={
                t('arbitrage_agent_desc') ||
                'Analytical MEXC spot bid/ask spread monitor. Does not execute trades.'
            }
            embedChildren
        >
            <ArbitrageWorkspace
                agent={agent}
                initialSection={initialSection}
                initialRunId={initialRunId}
                embedded
                onBack={handleClose}
                onNavigate={onNavigate}
                onUpdate={onUpdate}
            />
        </AgentControlShell>
    );
};

export default ArbitrageAgentPopup;

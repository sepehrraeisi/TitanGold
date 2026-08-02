import React from 'react';
import type { AIAgent } from '../../types.ts';
import type { ArbitrageAgentSection, OnNavigateHandler } from '../../types/navigation.ts';
import ArbitrageWorkspace from './ArbitrageWorkspace.tsx';

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
 * Uses Agent Product Template V1 via embedded ArbitrageWorkspace.
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
    const handleClose = () => {
        onClose();
        window.requestAnimationFrame(() => {
            returnFocusRef?.current?.focus?.();
        });
    };

    return (
        <ArbitrageWorkspace
            agent={agent}
            initialSection={initialSection}
            initialRunId={initialRunId}
            embedded
            onBack={handleClose}
            onNavigate={onNavigate}
            onUpdate={onUpdate}
        />
    );
};

export default ArbitrageAgentPopup;

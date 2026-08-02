import React from 'react';
import type { AIAgent } from '../../types.ts';
import type { TrendAgentSection, OnNavigateHandler } from '../../types/navigation.ts';
import TrendWorkspace from './TrendWorkspace.tsx';

export interface TrendAgentPopupProps {
  agent: AIAgent;
  initialSection?: TrendAgentSection;
  initialRunId?: string;
  onClose: () => void;
  onNavigate?: OnNavigateHandler;
  onUpdate: (agent: AIAgent) => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const TrendAgentPopup: React.FC<TrendAgentPopupProps> = ({
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
    window.requestAnimationFrame(() => returnFocusRef?.current?.focus?.());
  };

  return (
    <TrendWorkspace
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

export default TrendAgentPopup;

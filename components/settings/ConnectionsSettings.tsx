import React from 'react';
import MultiExchangeSettings from './MultiExchangeSettings.tsx';
import type { OnNavigateHandler } from '../../types/navigation.ts';

/**
 * Settings → Connections
 * Exchange connections only (WP1A / WP1A-R2).
 * Wallet UI lives under Settings → Wallet and must not appear here.
 */
type Props = {
  initialSubtab?: string;
  initialProvider?: string;
  initialSection?: string;
  onNavigate?: OnNavigateHandler;
};

const ConnectionsSettings: React.FC<Props> = ({
  initialSubtab,
  initialProvider,
  initialSection,
  onNavigate,
}) => {
  return (
    <div className="space-y-6">
      <MultiExchangeSettings
        initialSubtab={initialSubtab}
        initialProvider={initialProvider}
        initialSection={initialSection}
        onNavigate={onNavigate}
      />
    </div>
  );
};

export default ConnectionsSettings;

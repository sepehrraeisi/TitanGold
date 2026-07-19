import React from 'react';
import MultiExchangeSettings from './MultiExchangeSettings.tsx';

/**
 * Settings → Connections
 * Exchange connections only (WP1A / WP1A-R2).
 * Wallet UI lives under Settings → Wallet and must not appear here.
 */
const ConnectionsSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <MultiExchangeSettings />
    </div>
  );
};

export default ConnectionsSettings;

/**
 * Canonical AI Center mount for the completed Data Hub product.
 * Does not reimplement Data Hub — wraps the existing DataHubTab owner.
 */
import React, { useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import DataHubTab from './AIManager/tabs/DataHubTab.tsx';

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`bg-card border border-border rounded-lg p-4 ${className || ''}`}>{children}</div>
);

const DataHubWorkspace: React.FC = () => {
  const { t } = useLanguage();
  const onRefresh = useCallback(() => undefined, []);

  return (
    <div data-datahub-owner="canonical" data-testid="datahub-workspace">
      <DataHubTab t={t} onRefresh={onRefresh} Card={Card} />
    </div>
  );
};

export default DataHubWorkspace;

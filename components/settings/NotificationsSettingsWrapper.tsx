/**
 * NotificationsSettingsWrapper.tsx
 * 
 * Wrapper for NotificationsSettings that uses Backend API instead of LocalStorage
 * - Uses useUserPreferences hook
 * - Syncs with Database
 * - Handles loading/error states
 */

import React, { useEffect, useState } from 'react';
import { useUserPreferences } from '../../hooks/useUserPreferences.ts';
import NotificationsSettings from './NotificationsSettings.tsx';

interface NotificationsSettingsWrapperProps {
  userId: string;
}

const NotificationsSettingsWrapper: React.FC<NotificationsSettingsWrapperProps> = ({ userId }) => {
  const { preferences, loading, error, updatePreference } = useUserPreferences();
  const [migrated, setMigrated] = useState(false);

  // Auto-migrate NotificationsSettings from LocalStorage to Database
  useEffect(() => {
    if (!loading && !migrated) {
      const legacyKey = 'titan_notification_settings';
      const legacyData = localStorage.getItem(legacyKey);
      
      if (legacyData) {
        try {
          const parsed = JSON.parse(legacyData);
          console.log('🔄 Migrating Notification Settings from LocalStorage to Database...');
          
          // Migrate to backend
          updatePreference('notifications', parsed).then(() => {
            console.log('✅ Notification Settings migrated successfully');
            localStorage.removeItem(legacyKey); // Remove old data
            setMigrated(true);
          }).catch((err) => {
            console.error('❌ Migration failed:', err);
          });
        } catch (e) {
          console.error('Failed to parse legacy notification settings:', e);
        }
      } else {
        setMigrated(true);
      }
    }
  }, [loading, migrated, updatePreference]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg">
        <p className="text-red-500">Failed to load notification settings: {error}</p>
      </div>
    );
  }

  // Pass preferences to original NotificationsSettings component
  return (
    <NotificationsSettings 
      initialSettings={preferences?.notifications || {}}
      onSave={async (newSettings: any) => {
        await updatePreference('notifications', newSettings);
      }}
    />
  );
};

export default NotificationsSettingsWrapper;

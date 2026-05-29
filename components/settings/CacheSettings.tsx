import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface CacheInfo {
  localStorage: number;
  sessionStorage: number;
  indexedDB: string[];
  cacheStorage: string[];
  cookies: number;
  serviceWorker: boolean;
}

const CacheSettings: React.FC = () => {
  const { t } = useLanguage();
  const [isClearing, setIsClearing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [selectedTypes, setSelectedTypes] = useState({
    localStorage: true,
    sessionStorage: true,
    indexedDB: true,
    cacheStorage: true,
    cookies: false,
    serviceWorker: true,
  });

  // Get cache information
  const getCacheInfo = async (): Promise<CacheInfo> => {
    const info: CacheInfo = {
      localStorage: 0,
      sessionStorage: 0,
      indexedDB: [],
      cacheStorage: [],
      cookies: 0,
      serviceWorker: false,
    };

    // LocalStorage size
    try {
      let localStorageSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          localStorageSize += localStorage[key].length + key.length;
        }
      }
      info.localStorage = Math.round(localStorageSize / 1024); // KB
    } catch (e) {
      console.error('Error reading localStorage:', e);
    }

    // SessionStorage size
    try {
      let sessionStorageSize = 0;
      for (let key in sessionStorage) {
        if (sessionStorage.hasOwnProperty(key)) {
          sessionStorageSize += sessionStorage[key].length + key.length;
        }
      }
      info.sessionStorage = Math.round(sessionStorageSize / 1024); // KB
    } catch (e) {
      console.error('Error reading sessionStorage:', e);
    }

    // IndexedDB databases
    if ('indexedDB' in window) {
      try {
        const databases = await indexedDB.databases();
        info.indexedDB = databases.map((db) => db.name || 'unknown');
      } catch (e) {
        console.error('Error reading IndexedDB:', e);
      }
    }

    // Cache Storage
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        info.cacheStorage = cacheNames;
      } catch (e) {
        console.error('Error reading Cache Storage:', e);
      }
    }

    // Cookies count
    if (document.cookie) {
      info.cookies = document.cookie.split(';').length;
    }

    // Service Worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      info.serviceWorker = registrations.length > 0;
    }

    return info;
  };

  // Open modal and load cache info
  const handleOpenModal = async () => {
    setShowModal(true);
    const info = await getCacheInfo();
    setCacheInfo(info);
  };

  // Clear selected cache types
  const handleClearCache = async () => {
    setIsClearing(true);

    try {
      // Clear LocalStorage
      if (selectedTypes.localStorage) {
        localStorage.clear();
      }

      // Clear SessionStorage
      if (selectedTypes.sessionStorage) {
        sessionStorage.clear();
      }

      // Clear IndexedDB
      if (selectedTypes.indexedDB && 'indexedDB' in window) {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      }

      // Clear Cache Storage
      if (selectedTypes.cacheStorage && 'caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // Clear Cookies
      if (selectedTypes.cookies) {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
          document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        }
      }

      // Unregister Service Workers
      if (selectedTypes.serviceWorker && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }

      // Show success message
      setTimeout(() => {
        alert(t('cache_cleared_success') || 'Cache cleared successfully! The page will reload now.');
        
        // Reload page to show fresh content
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert(t('cache_clear_error') || 'Error clearing cache. Please try again.');
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('clear_cache') || 'Clear Cache'}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('clear_cache_description') ||
            'Clear browser cache to see the latest version of the app. This will log you out and reload the page.'}
        </p>
      </div>

      {/* Cache Info Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 border border-blue-200 dark:border-gray-600">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t('cache_info') || 'Cache Information'}
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {t('cache_info_desc') ||
                'Cached data helps the app load faster but may prevent you from seeing the latest updates.'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('local_storage') || 'Local Storage'}
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {localStorage.length} {t('items') || 'items'}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('session_storage') || 'Session Storage'}
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {sessionStorage.length} {t('items') || 'items'}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Clear Button */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleOpenModal}
          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          {t('clear_cache_now') || 'Clear Cache Now'}
        </button>

        <button
          onClick={() => window.location.reload()}
          className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {t('reload_page') || 'Reload Page'}
        </button>
      </div>

      {/* Warning Box */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-500">
              {t('warning') || 'Warning'}
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              {t('clear_cache_warning') ||
                'Clearing cache will log you out and remove all locally saved data. Make sure to save any unsaved work before proceeding.'}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-2">
              {t('clear_cache_datahub_note') ||
                'Clearing cache may remove legacy local DataHub snapshots; backend data in the database remains safe.'}
            </p>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => !isClearing && setShowModal(false)}>
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75" />

            {/* Modal panel */}
            <div
              className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  {t('clear_cache_options') || 'Clear Cache Options'}
                </h3>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {/* Cache types selection */}
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTypes.localStorage}
                        onChange={(e) => setSelectedTypes({ ...selectedTypes, localStorage: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {t('local_storage') || 'Local Storage'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {cacheInfo?.localStorage || 0} KB
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTypes.sessionStorage}
                        onChange={(e) => setSelectedTypes({ ...selectedTypes, sessionStorage: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {t('session_storage') || 'Session Storage'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {cacheInfo?.sessionStorage || 0} KB
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTypes.indexedDB}
                        onChange={(e) => setSelectedTypes({ ...selectedTypes, indexedDB: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">IndexedDB</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {cacheInfo?.indexedDB.length || 0} {t('databases') || 'databases'}
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTypes.cacheStorage}
                        onChange={(e) => setSelectedTypes({ ...selectedTypes, cacheStorage: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {t('cache_storage') || 'Cache Storage'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {cacheInfo?.cacheStorage.length || 0} {t('caches') || 'caches'}
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTypes.serviceWorker}
                        onChange={(e) => setSelectedTypes({ ...selectedTypes, serviceWorker: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {t('service_worker') || 'Service Worker'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {cacheInfo?.serviceWorker ? t('active') || 'Active' : t('inactive') || 'Inactive'}
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTypes.cookies}
                        onChange={(e) => setSelectedTypes({ ...selectedTypes, cookies: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {t('cookies') || 'Cookies'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {cacheInfo?.cookies || 0} {t('cookies') || 'cookies'}
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={isClearing}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleClearCache}
                  disabled={isClearing}
                  className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isClearing ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      {t('clearing') || 'Clearing...'}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      {t('clear_selected') || 'Clear Selected'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CacheSettings;

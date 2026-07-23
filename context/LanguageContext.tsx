import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import enTranslations from '../deploy/blue/locales/en.json';
import faTranslations from '../deploy/blue/locales/fa.json';

type Language = 'en' | 'fa';
type Translations = { [key: string]: string };

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, options?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'titan_language';

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'fa' || stored === 'en') return stored;
  } catch {
    // ignore storage failures
  }
  return 'en';
}

function applyDocumentLanguage(language: Language): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  document.documentElement.classList.toggle('lang-fa', language === 'fa');
  document.documentElement.classList.toggle('lang-en', language === 'en');
}

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage());
  const [translations] = useState<{ [key in Language]: Translations }>({
    en: enTranslations as Translations,
    fa: faTranslations as Translations,
  });

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
    applyDocumentLanguage(next);
  }, []);

  useEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  const t = useCallback((key: string, options?: { [key: string]: string | number }): string => {
    let translation = translations[language]?.[key] || key;
    if (options) {
      Object.keys(options).forEach(optionKey => {
        const regex = new RegExp(`\\{${optionKey}\\}`, 'g');
        translation = translation.replace(regex, String(options[optionKey]));
      });
    }
    return translation;
  }, [language, translations]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  
  // Fail-safe: never crash the UI
  if (!context) {
    console.warn('⚠️ useLanguage called outside LanguageProvider - using fallback');
    return {
      language: 'en',
      setLanguage: () => {},
      t: (key: string) => key, // Return key as-is (identity function)
    };
  }
  
  return context;
};

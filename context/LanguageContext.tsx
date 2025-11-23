import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import enTranslations from '../locales/en.json';
import faTranslations from '../locales/fa.json';

type Language = 'en' | 'fa';
type Translations = { [key: string]: string };

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, options?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [translations] = useState<{ [key in Language]: Translations }>({
    en: enTranslations as Translations,
    fa: faTranslations as Translations,
  });

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
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

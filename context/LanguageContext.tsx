import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';

type Language = 'en' | 'fa';
type Translations = { [key: string]: string };

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  // FIX: Update `t` function signature to accept an options object for interpolation.
  t: (key: string, options?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [translations, setTranslations] = useState<{ [key in Language]?: Translations }>({});

  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        const [enResponse, faResponse] = await Promise.all([
          fetch('./locales/en.json'),
          fetch('./locales/fa.json')
        ]);
        const enData = await enResponse.json();
        const faData = await faResponse.json();
        setTranslations({ en: enData, fa: faData });
      } catch (error) {
        console.error("Failed to load translations:", error);
      }
    };

    fetchTranslations();
  }, []);

  // FIX: Implement interpolation logic in the `t` function to handle dynamic values.
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

  // To prevent flash of untranslated content, we wait for translations to load.
  if (!translations.en || !translations.fa) {
    return null; // Or return a loading spinner component
  }

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

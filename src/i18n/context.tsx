'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SupportedLanguage, TranslationDictionary } from './types';
import { en } from './en';
import { hi } from './hi';

interface LanguageContextType {
  lang: SupportedLanguage;
  setLang: (lang: SupportedLanguage) => void;
  toggleLang: () => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  dictionary: TranslationDictionary;
}

const dictionaries: Record<SupportedLanguage, TranslationDictionary> = { en, hi };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'shikshasetu_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<SupportedLanguage>('hi'); // Default Hindi for Jaipur context

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
      if (saved && (saved === 'en' || saved === 'hi')) {
        setLangState(saved);
        document.documentElement.lang = saved;
      } else {
        document.documentElement.lang = 'hi';
      }
    } catch {
      // Ignore local storage errors in sandboxed environments
    }
  }, []);

  const setLang = (newLang: SupportedLanguage) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch {
      // Ignore storage errors
    }
  };

  const toggleLang = () => {
    setLang(lang === 'en' ? 'hi' : 'en');
  };

  const t = (path: string, params?: Record<string, string | number>): string => {
    const currentDict = dictionaries[lang] || en;
    const parts = path.split('.');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = currentDict;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        // Fallback to English
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fallback: any = en;
        for (const p of parts) {
          if (fallback && typeof fallback === 'object' && p in fallback) {
            fallback = fallback[p];
          } else {
            return path;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== 'string') {
      return path;
    }

    if (!params) return current;

    let interpolated = current;
    for (const [key, val] of Object.entries(params)) {
      interpolated = interpolated.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
    }
    return interpolated;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, dictionary: dictionaries[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

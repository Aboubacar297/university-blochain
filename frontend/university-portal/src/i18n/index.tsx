import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fr, type MessageKey } from './fr';
import { en } from './en';
import { formatDate, formatDateTime } from '../lib/format';

export type Lang = 'fr' | 'en';
export type { MessageKey };
export type TFunction = (key: MessageKey, params?: Record<string, string | number>) => string;

const dictionaries: Record<Lang, Record<MessageKey, string>> = { fr, en };
const STORAGE_KEY = 'portal.lang';

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {
    /* stockage indisponible */
  }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunction;
  date: (value: string) => string;
  dateTime: (value: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = 'ltr';
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignoré */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = dictionaries[lang];
    const t: TFunction = (key, params) => {
      let text = dict[key] ?? key;
      if (params) {
        for (const [name, v] of Object.entries(params)) text = text.split(`{${name}}`).join(String(v));
      }
      return text;
    };
    return { lang, setLang, t, date: (v) => formatDate(lang, v), dateTime: (v) => formatDateTime(lang, v) };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n doit être utilisé dans <I18nProvider>');
  return ctx;
}

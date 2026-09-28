import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import type { Lang } from '../types';
import ko from '../locales/ko.json';
import en from '../locales/en.json';

const KEY = 'itys-lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'ko' || saved === 'en') return saved;
  } catch {
    /* storage blocked */
  }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'ko';
}

void i18n.use(initReactI18next).init({
  resources: { ko: { translation: ko }, en: { translation: en } },
  lng: initialLang(),
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
  showSupportNotice: false,
});

document.documentElement.lang = i18n.language;

export function setLang(lang: Lang) {
  void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* storage blocked */
  }
}

/** useTranslation plus the current language, narrowed to the ones we ship. */
export function useLang() {
  const { t, i18n: inst } = useTranslation();
  const lang: Lang = inst.language === 'en' ? 'en' : 'ko';
  return { t, lang };
}

export default i18n;

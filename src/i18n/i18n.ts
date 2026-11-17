import kk from './locales/kk/common.json';
import ru from './locales/ru/common.json';
import en from './locales/en/common.json';
export type Lang = 'kk' | 'ru' | 'en';
export const LANGS: Lang[] = ['kk', 'ru', 'en'];
export const dict: Record<Lang, Record<string, string>> = { kk, ru, en };
/** Резерв: выбранный язык → русский → ключ. Пропуски ловятся тестом полноты. */
export const t = (lang: Lang, key: string) => dict[lang][key] ?? dict.ru[key] ?? key;
export const missingKeys = (): Record<Lang, string[]> => {
  const all = new Set(LANGS.flatMap(l => Object.keys(dict[l])));
  return Object.fromEntries(LANGS.map(l => [l, [...all].filter(k => !dict[l][k])])) as Record<Lang, string[]>;
};

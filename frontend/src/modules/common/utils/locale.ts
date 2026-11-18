export type Direction = 'ltr' | 'rtl';

export const getDirection = (locale: string): Direction => {
  return ['dr', 'ps'].includes(locale) ? 'rtl' : 'ltr';
};

export const getLanguageTag = (locale: string): string => {
  if (locale === 'dr') return 'prs-AF';
  if (locale === 'ps') return 'ps-AF';
  return locale;
};

export const getIntlLocale = (locale: string): string => {
  if (locale === 'dr') return 'fa-AF';
  if (locale === 'ps') return 'ps-AF';
  return locale;
};

export const LOCALE_TO_FIELD_SUFFIX: Record<string, string> = {
  dr: 'Dr',
  en: 'En',
  ps: 'Ps',
};

export const getLocalizedFieldKey = (base: string, locale: string): string => {
  const suffix = LOCALE_TO_FIELD_SUFFIX[locale] || LOCALE_TO_FIELD_SUFFIX.en;
  return `${base}${suffix}`;
};

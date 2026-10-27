import { getRequestConfig } from 'next-intl/server';
import en from '../messages/en.json';
import hi from '../messages/hi.json';
import mr from '../messages/mr.json';

export const locales = ['en', 'hi', 'mr'] as const;
export type Locale = (typeof locales)[number];

/**
 * Deep merge a target message dictionary with English fallback.
 * Ensures missing or empty keys in Hindi / Marathi visibly fallback to English (never a blank).
 */
function mergeWithFallback(target: Record<string, any>, fallback: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...fallback };
  for (const key of Object.keys(target)) {
    const val = target[key];
    if (val !== undefined && val !== null && val !== "") {
      if (typeof val === 'object' && !Array.isArray(val)) {
        result[key] = mergeWithFallback(val, fallback[key] || {});
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  const currentLocale = (locale && (locales as readonly string[]).includes(locale)) ? locale : 'en';

  let rawMessages: Record<string, any>;
  if (currentLocale === 'hi') {
    rawMessages = hi;
  } else if (currentLocale === 'mr') {
    rawMessages = mr;
  } else {
    rawMessages = en;
  }

  // Always merge against English fallback so missing strings are never blank
  const messages = currentLocale === 'en' ? en : mergeWithFallback(rawMessages, en);

  return {
    locale: currentLocale,
    messages,
  };
});

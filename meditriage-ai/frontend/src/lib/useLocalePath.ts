'use client';

import { useLocale } from 'next-intl';

/**
 * Returns a function that prefixes paths with the current locale.
 * Usage: const lp = useLocalePath(); lp('/dashboard/patient') => '/en/dashboard/patient'
 */
export function useLocalePath() {
  const locale = useLocale();
  return (path: string) => `/${locale}${path}`;
}

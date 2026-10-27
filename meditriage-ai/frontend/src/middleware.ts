import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n';

export default createMiddleware({
  // A list of all locales that are supported
  locales: locales,
 
  // Used when no locale matches
  defaultLocale: 'en'
});
 
export const config = {
  // Match all pathnames except for API routes, internal Next.js paths, and static files
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};

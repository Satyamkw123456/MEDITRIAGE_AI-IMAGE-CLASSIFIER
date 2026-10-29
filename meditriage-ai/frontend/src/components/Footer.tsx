'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { ShieldCheck, PhoneCall } from 'lucide-react';

export const Footer: React.FC = () => {
  const locale = useLocale();
  const pathname = usePathname();

  // Suppress on dedicated internal workspaces that have their own sidebar/footer
  const hasDedicatedLayout = [
    '/dashboard/clinician',
    '/dashboard/admin',
  ].some((prefix) => pathname?.includes(prefix));

  if (hasDedicatedLayout) {
    return null;
  }

  return (
    <footer className="border-t border-line bg-surface py-10 mt-auto transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-line">
          <div className="flex items-center space-x-3">
            <Link href={`/${locale}`} className="flex items-center space-x-2">
              <img src="/logo.svg" alt="MediTriage AI" className="h-8 w-auto object-contain" />
            </Link>
            <span className="text-xs text-muted">
              v1.0.4 • Clinical Decision Support System
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-muted font-medium">
            <Link href={`/${locale}/resources`} className="hover:text-ink transition">
              Emergency Directory
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-ink transition">
              DPDP Privacy Notice
            </Link>
            <Link href={`/${locale}/terms`} className="hover:text-ink transition">
              Terms of Service
            </Link>
            <a
              href="tel:112"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emergency-soft text-emergency font-bold border border-emergency/25 hover:bg-emergency hover:text-surface transition"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Emergency: 112</span>
            </a>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span>
              Decision support only. A licensed clinician always verifies triage recommendations.
            </span>
          </div>
          <div>
            &copy; {new Date().getFullYear()} MediTriage AI. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

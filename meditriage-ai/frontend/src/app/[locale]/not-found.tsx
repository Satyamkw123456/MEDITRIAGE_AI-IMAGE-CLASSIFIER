'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Compass, Home, PhoneCall, ArrowLeft, HeartPulse, FileQuestion } from 'lucide-react';

export default function NotFound() {
  const locale = useLocale();

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-lg bg-surface rounded-card border border-line shadow-card p-8 sm:p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-primary-soft text-primary flex items-center justify-center mx-auto mb-5 shadow-xs">
          <Compass className="w-7 h-7" aria-hidden="true" />
        </div>

        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          404 • Resource Not Found
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink font-display mt-1 mb-2">
          Page Not Located
        </h1>
        <p className="text-sm text-muted leading-relaxed max-w-md mx-auto mb-8">
          The requested clinical destination, case record, or document link could not be found or may have been relocated.
        </p>

        {/* Recovery Links Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 text-left">
          <Link
            href={`/${locale}`}
            className="p-3.5 rounded-xl border border-line bg-bg hover:bg-bg-tint hover:border-primary/40 transition flex items-center gap-3"
          >
            <Home className="w-4 h-4 text-primary shrink-0" />
            <div>
              <span className="block text-xs font-bold text-ink">App Home</span>
              <span className="block text-[11px] text-muted">Portal start &amp; dashboards</span>
            </div>
          </Link>

          <Link
            href={`/${locale}/resources`}
            className="p-3.5 rounded-xl border border-line bg-bg hover:bg-bg-tint hover:border-primary/40 transition flex items-center gap-3"
          >
            <HeartPulse className="w-4 h-4 text-routine shrink-0" />
            <div>
              <span className="block text-xs font-bold text-ink">Emergency Directory</span>
              <span className="block text-[11px] text-muted">Hospitals &amp; ambulances</span>
            </div>
          </Link>
        </div>

        {/* Persistent 112 Reminder */}
        <div className="p-3.5 rounded-xl border border-emergency/25 bg-emergency-soft text-xs text-emergency flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold">
            <PhoneCall className="w-4 h-4 shrink-0" />
            <span>Experiencing a medical emergency?</span>
          </div>
          <a
            href="tel:112"
            className="px-3 py-1 rounded-lg bg-emergency text-surface font-bold text-xs hover:opacity-95 transition shadow-xs"
          >
            Call 112 Now
          </a>
        </div>
      </div>
    </div>
  );
}

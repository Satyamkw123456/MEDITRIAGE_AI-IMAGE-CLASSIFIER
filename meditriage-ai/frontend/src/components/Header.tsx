'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from 'next-intl';
import { LogOut, User as UserIcon, Shield, Stethoscope, HeartPulse, PhoneCall, Eye, EyeOff } from 'lucide-react';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useElderMode } from '@/hooks/useElderMode';

export const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const locale = useLocale();
  const pathname = usePathname();
  const { elderMode, toggleElderMode } = useElderMode();

  // Suppress global Header on routes that provide their own dedicated layout (PatientLayout, ClinicianLayout, AdminLayout, Paramedic)
  const hasDedicatedLayout = [
    '/dashboard',
    '/triage',
    '/patient',
    '/cases',
    '/emergency-card',
    '/resources',
    '/ai-hub',
    '/media',
    '/gallery',
  ].some((prefix) => pathname?.includes(prefix));

  if (hasDedicatedLayout) {
    return null;
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'clinician':
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-primary-soft text-primary font-semibold px-2.5 py-0.5 rounded-full border border-primary/20">
            <Stethoscope className="w-3 h-3" /> Clinician
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-urgent-soft text-urgent font-semibold px-2.5 py-0.5 rounded-full border border-urgent/20">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-routine-soft text-routine font-semibold px-2.5 py-0.5 rounded-full border border-routine/20">
            <HeartPulse className="w-3 h-3" /> Patient
          </span>
        );
    }
  };

  const getDashboardLink = () => {
    if (!user) return `/${locale}`;
    if (user.role === 'clinician') return `/${locale}/dashboard/clinician`;
    if (user.role === 'admin') return `/${locale}/dashboard/admin`;
    return `/${locale}/dashboard/patient`;
  };

  return (
    <header className="border-b border-line glass sticky top-0 z-30 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href={`/${locale}`} className="flex items-center space-x-3 group py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
            <img src="/logo.svg" alt="MediTriage AI" className="h-11 sm:h-12 w-auto object-contain transition-transform group-hover:scale-105" />
            <span className="hidden sm:inline-block text-xs bg-primary-soft text-primary font-semibold px-2.5 py-0.5 rounded-full border border-primary/20">
              Clinical Platform
            </span>
          </Link>

          {/* Persistent Emergency 112 Dial Pill for Patient & Signed-out Users */}
          {(!user || user.role === 'patient') && (
            <a
              href="tel:112"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emergency text-surface text-xs font-bold shadow-xs hover:opacity-95 transition"
              aria-label="Emergency call 112"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Emergency: 112</span>
            </a>
          )}
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Elder Mode Toggle */}
          <button
            type="button"
            onClick={toggleElderMode}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              elderMode
                ? "bg-primary text-surface border-primary shadow-xs"
                : "bg-surface text-ink border-line hover:border-primary/40"
            }`}
            aria-pressed={elderMode}
            title={elderMode ? "Disable Elder Mode" : "Enable Elder Mode"}
          >
            {elderMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{elderMode ? "Elder Mode ON" : "Elder Mode"}</span>
          </button>

          {(!user || user.role === 'patient') && <LanguageSwitcher />}

          {isAuthenticated && user ? (
            <div className="flex items-center space-x-3">
              <Link
                href={getDashboardLink()}
                className="flex items-center space-x-2 text-sm text-ink hover:text-primary font-medium px-3 py-1.5 rounded-xl hover:bg-bg-tint transition"
              >
                <UserIcon className="w-4 h-4 text-muted" />
                <span className="hidden sm:inline font-semibold">{user.name}</span>
                {getRoleBadge(user.role)}
              </Link>
              <button
                onClick={logout}
                className="flex items-center space-x-1 text-xs text-emergency hover:opacity-90 font-semibold border border-emergency/25 bg-emergency-soft px-3 py-1.5 rounded-xl transition"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                href={`/${locale}/login`}
                className="text-sm font-medium text-ink hover:text-primary px-3 py-1.5 rounded-xl hover:bg-bg-tint transition"
              >
                Sign In
              </Link>
              <Link
                href={`/${locale}/register`}
                className="text-sm font-semibold text-surface bg-primary hover:bg-primary-hover px-4 py-1.5 rounded-xl shadow-xs transition"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

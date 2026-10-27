'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from 'next-intl';
import { LogOut, User as UserIcon, Shield, Stethoscope, HeartPulse } from 'lucide-react';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';

export const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const locale = useLocale();

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'clinician':
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-300">
            <Stethoscope className="w-3 h-3" /> Clinician
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-800 font-semibold px-2.5 py-0.5 rounded-full border border-purple-300">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-teal-100 text-teal-800 font-semibold px-2.5 py-0.5 rounded-full border border-teal-300">
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
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center space-x-3 group">
          <div className="w-9 h-9 rounded-lg bg-teal-600 group-hover:bg-teal-700 transition flex items-center justify-center text-white font-bold text-lg shadow">
            +
          </div>
          <div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">
              MediTriage <span className="text-teal-600">AI</span>
            </span>
            <span className="ml-2 text-xs bg-teal-50 text-teal-800 font-semibold px-2 py-0.5 rounded-full border border-teal-200">
              Clinical Platform
            </span>
          </div>
        </Link>

        <div className="flex items-center space-x-4">
          {(!user || user.role === 'patient') && <LanguageSwitcher />}
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-3">
              <Link
                href={getDashboardLink()}
                className="flex items-center space-x-2 text-sm text-slate-700 hover:text-teal-600 font-medium px-3 py-1.5 rounded-md hover:bg-slate-100 transition"
              >
                <UserIcon className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline font-semibold">{user.name}</span>
                {getRoleBadge(user.role)}
              </Link>
              <button
                onClick={logout}
                className="flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 font-semibold border border-rose-200 hover:border-rose-300 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-md transition"
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
                className="text-sm font-medium text-slate-700 hover:text-teal-600 px-3 py-1.5 rounded-md hover:bg-slate-100 transition"
              >
                Sign In
              </Link>
              <Link
                href={`/${locale}/register`}
                className="text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 px-3.5 py-1.5 rounded-md shadow-sm transition"
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

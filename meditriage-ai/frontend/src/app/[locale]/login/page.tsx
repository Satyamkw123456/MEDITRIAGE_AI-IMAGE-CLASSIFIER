'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, AlertCircle, ArrowRight, Stethoscope, HeartPulse, Shield, X, Clock } from 'lucide-react';
import { useLocale } from 'next-intl';

function LoginForm() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showExpiredToast, setShowExpiredToast] = useState(false);
  const locale = useLocale();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams?.get('expired') === '1') {
      setShowExpiredToast(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  const handleDemoFill = (role: 'patient' | 'clinician' | 'admin') => {
    setError(null);
    if (role === 'patient') {
      setEmail('patient@meditriage.ai');
      setPassword('Patient@123');
    } else if (role === 'clinician') {
      setEmail('doctor@meditriage.ai');
      setPassword('Doctor@123');
    } else {
      setEmail('admin@meditriage.ai');
      setPassword('Admin@123');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 relative">
      {/* Session Expired Toast */}
      {showExpiredToast && (
        <div
          role="alert"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 bg-amber-500 text-white rounded-xl shadow-xl border border-amber-600 transition-all"
        >
          <Clock className="w-5 h-5 flex-shrink-0 text-white" />
          <span className="text-sm font-semibold">Session expired, please sign in again</span>
          <button
            type="button"
            onClick={() => setShowExpiredToast(false)}
            className="ml-2 text-white/80 hover:text-white transition p-0.5 rounded"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Top Header banner */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-900 px-6 py-6 text-white text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-3">
            <ShieldCheck className="w-6 h-6 text-teal-200" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Clinical Portal Sign In</h1>
          <p className="text-xs text-teal-100 mt-1">
            Role-Based Access Control • Geriatric Decision-Support Layer
          </p>
        </div>

        {/* Demo Persona Quick Fill Bar (gated on demo mode) */}
        {isDemoMode && (
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Quick Demo Auto-Fill (Dev/Demo Only):
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('patient')}
                className="flex items-center justify-center gap-1 text-xs font-medium bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 py-1.5 px-2 rounded-lg transition"
              >
                <HeartPulse className="w-3 h-3 text-teal-600" /> Patient
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('clinician')}
                className="flex items-center justify-center gap-1 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-1.5 px-2 rounded-lg transition"
              >
                <Stethoscope className="w-3 h-3 text-emerald-600" /> Clinician
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('admin')}
                className="flex items-center justify-center gap-1 text-xs font-medium bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 py-1.5 px-2 rounded-lg transition"
              >
                <Shield className="w-3 h-3 text-purple-600" /> Admin
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@hospital.org or email@example.com"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  Password
                </label>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-500">
            Don&apos;t have an account yet?{' '}
            <Link href={`/${locale}/register`} className="font-semibold text-teal-600 hover:text-teal-700 hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[85vh] flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

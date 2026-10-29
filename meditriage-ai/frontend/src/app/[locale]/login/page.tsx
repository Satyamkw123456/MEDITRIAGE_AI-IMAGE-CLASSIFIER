'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  ShieldCheck, 
  AlertCircle, 
  ArrowRight, 
  Stethoscope, 
  HeartPulse, 
  Shield, 
  X, 
  Clock,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';

function LoginForm() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(msg);
    }
  };

  const isDemoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';

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
    <div className="min-h-[90vh] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative">
      {/* Session Expired Toast */}
      {showExpiredToast && (
        <div
          role="alert"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 bg-urgent text-surface rounded-xl shadow-lg border border-urgent transition-all"
        >
          <Clock className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">Session expired, please sign in again</span>
          <button
            type="button"
            onClick={() => setShowExpiredToast(false)}
            className="ml-2 text-surface/80 hover:text-surface transition p-0.5 rounded"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Split Layout Container */}
      <div className="w-full max-w-4xl bg-surface rounded-panel border border-line shadow-card overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Value / Trust Panel (Desktop) */}
        <div className="hidden lg:flex lg:col-span-5 bg-bg-tint border-r border-line p-8 flex-col justify-between">
          <div>
            <Link href={`/${locale}`} className="inline-block mb-8">
              <img 
                src="/logo.svg" 
                alt="MediTriage AI" 
                className="h-10 w-auto object-contain hover:opacity-95 transition-opacity" 
              />
            </Link>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-soft text-primary border border-line">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Clinical Decision Support</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-ink font-display leading-tight">
                Triage grounded in personal baselines.
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                Advanced clinical triage designed for geriatric patients, family caregivers, and attending hospital teams.
              </p>
            </div>
          </div>

          <div className="space-y-3.5 pt-8 border-t border-line">
            <div className="flex items-start gap-2.5 text-xs text-ink/90">
              <CheckCircle2 className="w-4 h-4 text-selfcare shrink-0 mt-0.5" />
              <span><strong>DPDP Act 2023:</strong> Full consent &amp; privacy rights protection.</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-ink/90">
              <CheckCircle2 className="w-4 h-4 text-selfcare shrink-0 mt-0.5" />
              <span><strong>Clinician in the Loop:</strong> Physician always verifies triage determinations.</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-ink/90">
              <CheckCircle2 className="w-4 h-4 text-selfcare shrink-0 mt-0.5" />
              <span><strong>Multi-lingual:</strong> English, हिन्दी, and मराठी language support.</span>
            </div>
          </div>
        </div>

        {/* Right Form Container */}
        <div className="col-span-1 lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="lg:hidden">
                <Link href={`/${locale}`}>
                  <img src="/logo.svg" alt="MediTriage AI" className="h-9 w-auto object-contain" />
                </Link>
              </div>
              <div className="ml-auto">
                <LanguageSwitcher />
              </div>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-ink tracking-tight">Sign in to your account</h1>
              <p className="text-sm text-muted mt-1">
                Enter your credentials to access your dashboard.
              </p>
            </div>

            {/* Demo Persona Quick Fill Bar */}
            {isDemoMode && (
              <div className="mb-6 p-3 rounded-card bg-bg border border-line">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
                  Quick Demo Auto-Fill:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDemoFill('patient')}
                    className="flex items-center justify-center gap-1 text-xs font-semibold bg-surface hover:bg-primary-soft text-primary border border-line py-2 px-2 rounded-lg transition shadow-xs"
                  >
                    <HeartPulse className="w-3.5 h-3.5 text-primary" /> Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoFill('clinician')}
                    className="flex items-center justify-center gap-1 text-xs font-semibold bg-surface hover:bg-routine-soft text-routine border border-line py-2 px-2 rounded-lg transition shadow-xs"
                  >
                    <Stethoscope className="w-3.5 h-3.5 text-routine" /> Clinician
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoFill('admin')}
                    className="flex items-center justify-center gap-1 text-xs font-semibold bg-surface hover:bg-bg-tint text-ink border border-line py-2 px-2 rounded-lg transition shadow-xs"
                  >
                    <Shield className="w-3.5 h-3.5 text-ink" /> Admin
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div 
                role="alert" 
                aria-live="polite"
                className="mb-5 p-3.5 bg-emergency-soft border border-emergency rounded-xl flex items-start gap-2.5 text-emergency text-sm"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-ink mb-1.5">
                  Email Address <span className="text-emergency">*</span>
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@hospital.org or patient@example.com"
                  className="w-full min-h-[48px] px-3.5 rounded-lg border border-border-control bg-surface text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-semibold text-ink">
                    Password <span className="text-emergency">*</span>
                  </label>
                  <span className="text-xs text-muted hover:text-ink cursor-pointer" title="Contact administrator for password resets">
                    Forgot password?
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full min-h-[48px] px-3.5 pr-10 rounded-lg border border-border-control bg-surface text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[48px] mt-2 bg-primary hover:bg-primary-hover text-surface font-semibold py-3 px-4 rounded-xl shadow-button transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Sign In to Platform</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-8 pt-6 border-t border-line text-center text-sm text-muted">
            Don&apos;t have an account yet?{' '}
            <Link 
              href={`/${locale}/register`} 
              className="font-semibold text-primary hover:text-primary-hover underline underline-offset-2"
            >
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
    <Suspense fallback={<div className="min-h-[85vh] flex items-center justify-center text-muted">Loading sign in...</div>}>
      <LoginForm />
    </Suspense>
  );
}

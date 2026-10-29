'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, 
  ShieldCheck, 
  HeartPulse, 
  Stethoscope, 
  ArrowRight, 
  UserCheck, 
  UserPlus, 
  QrCode, 
  Users, 
  Bot, 
  Sparkles,
  ClipboardList,
  Activity,
  Layers,
  FileText
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from 'next-intl';
import TrustStrip from '@/components/shared/TrustStrip';

export default function HomePage() {
  const locale = useLocale();
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      {/* Refined Clinical Safety Banner (Verbatim copy, no emoji) */}
      <div 
        role="region"
        aria-label="Clinical Safety Notice"
        className="mb-8 p-4 sm:p-5 rounded-card border border-urgent/30 bg-urgent-soft text-ink shadow-xs flex items-start gap-3.5"
      >
        <div className="w-8 h-8 rounded-full bg-urgent/15 text-urgent flex items-center justify-center shrink-0 mt-0.5">
          <ShieldAlert className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="text-sm leading-relaxed">
          <strong className="font-bold text-ink block mb-0.5">
            Clinical Safety Notice — Decision Support Only
          </strong>
          This system provides AI-assisted clinical decision support. It does not replace professional emergency care or clinician judgment. A human clinician always makes the final decision under India&apos;s DPDP Act, 2023 principles.
        </div>
      </div>

      {isAuthenticated && user ? (
        /* Signed-in Home: Role-based quick actions */
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Welcome back
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-ink font-display mt-0.5">
                {user.name}
              </h1>
              <p className="text-sm text-muted mt-1">
                Role: <span className="font-semibold text-ink capitalize">{user.role}</span> • Session authenticated
              </p>
            </div>

            <div>
              {user.role === 'patient' && (
                <Link
                  href={`/${locale}/triage/consent`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-surface text-sm font-bold rounded-xl shadow-button transition"
                >
                  <Activity className="w-4 h-4" />
                  <span>Start New Triage</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              {user.role === 'clinician' && (
                <Link
                  href={`/${locale}/dashboard/clinician`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-surface text-sm font-bold rounded-xl shadow-button transition"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Open Priority Queue</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              {user.role === 'admin' && (
                <Link
                  href={`/${locale}/dashboard/admin`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-surface text-sm font-bold rounded-xl shadow-button transition"
                >
                  <Layers className="w-4 h-4" />
                  <span>Open Admin Control Plane</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          {/* Role specific quick action tiles */}
          {user.role === 'patient' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href={`/${locale}/triage/consent`}
                className="p-5 rounded-card border border-line bg-surface hover:border-primary/50 hover:bg-bg-tint/40 shadow-card transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-3">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-ink group-hover:text-primary transition">
                  Start Triage Assessment
                </h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Log current symptoms with geriatric baseline analysis.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary mt-3">
                  Begin intake &rarr;
                </span>
              </Link>

              <Link
                href={`/${locale}/patient/emergency-card`}
                className="p-5 rounded-card border border-line bg-surface hover:border-primary/50 hover:bg-bg-tint/40 shadow-card transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-routine-soft text-routine flex items-center justify-center mb-3">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-ink group-hover:text-routine transition">
                  My Emergency QR Card
                </h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Expiring encrypted emergency profile for first responders.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-routine mt-3">
                  Manage card &rarr;
                </span>
              </Link>

              <Link
                href={`/${locale}/patient/caregivers`}
                className="p-5 rounded-card border border-line bg-surface hover:border-primary/50 hover:bg-bg-tint/40 shadow-card transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-selfcare-soft text-selfcare flex items-center justify-center mb-3">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-ink group-hover:text-selfcare transition">
                  Authorized Caregivers
                </h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Manage proxy delegates and family care permissions.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-selfcare mt-3">
                  View caregivers &rarr;
                </span>
              </Link>

              <Link
                href={`/${locale}/ai-hub`}
                className="p-5 rounded-card border border-line bg-surface hover:border-primary/50 hover:bg-bg-tint/40 shadow-card transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-3">
                  <Bot className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-ink group-hover:text-primary transition">
                  AI Clinical Hub
                </h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Interactive health companion, summary explainer, and visit prep.
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary mt-3">
                  Open AI Hub &rarr;
                </span>
              </Link>
            </div>
          )}

          {user.role === 'clinician' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <Link
                href={`/${locale}/dashboard/clinician`}
                className="p-6 rounded-card border border-line bg-surface hover:border-primary/50 shadow-card transition"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-3">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-ink">Priority Queue</h3>
                <p className="text-xs text-muted mt-1">Real-time geriatric triage queue with red-flag badges.</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary mt-4">
                  Review waiting cases &rarr;
                </span>
              </Link>

              <Link
                href={`/${locale}/resources`}
                className="p-6 rounded-card border border-line bg-surface hover:border-primary/50 shadow-card transition"
              >
                <div className="w-10 h-10 rounded-xl bg-routine-soft text-routine flex items-center justify-center mb-3">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-ink">Emergency Directory</h3>
                <p className="text-xs text-muted mt-1">Verified Pune-first 24x7 hospitals, ambulances, and wards.</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-routine mt-4">
                  Open directory &rarr;
                </span>
              </Link>

              <div className="p-6 rounded-card border border-line bg-surface shadow-card">
                <div className="w-10 h-10 rounded-xl bg-selfcare-soft text-selfcare flex items-center justify-center mb-3">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-ink">Active Shift Status</h3>
                <p className="text-xs text-muted mt-1">Attending clinician verified • Cryptographic logs active.</p>
                <div className="mt-4 text-xs font-medium text-selfcare flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-selfcare animate-pulse" />
                  Ready for Intake Reviews
                </div>
              </div>
            </div>
          )}

          {user.role === 'admin' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <Link
                href={`/${locale}/dashboard/admin`}
                className="p-6 rounded-card border border-line bg-surface hover:border-primary/50 shadow-card transition"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-3">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-ink">Operations Control</h3>
                <p className="text-xs text-muted mt-1">System health, background jobs, and active workloads.</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary mt-4">
                  Go to Overview &rarr;
                </span>
              </Link>

              <Link
                href={`/${locale}/dashboard/admin/audit`}
                className="p-6 rounded-card border border-line bg-surface hover:border-primary/50 shadow-card transition"
              >
                <div className="w-10 h-10 rounded-xl bg-urgent-soft text-urgent flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-ink">Audit Explorer</h3>
                <p className="text-xs text-muted mt-1">DPDP 2023 tamper-evident hash-chained logs.</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-urgent mt-4">
                  Explore ledger &rarr;
                </span>
              </Link>

              <Link
                href={`/${locale}/dashboard/admin/ai-control`}
                className="p-6 rounded-card border border-line bg-surface hover:border-primary/50 shadow-card transition"
              >
                <div className="w-10 h-10 rounded-xl bg-routine-soft text-routine flex items-center justify-center mb-3">
                  <Bot className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-ink">AI Safety Controls</h3>
                <p className="text-xs text-muted mt-1">Model allowlist, prompt registry, and kill switches.</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-routine mt-4">
                  Manage AI &rarr;
                </span>
              </Link>
            </div>
          )}
        </div>
      ) : (
        /* Signed-out Home: Calm hero + 3 value cards + TrustStrip */
        <div className="space-y-12">
          <div className="text-center max-w-3xl mx-auto pt-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary-soft text-primary border border-line mb-4">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Geriatric Decision-Support Intelligence</span>
              <span>•</span>
              <span>DPDP Act 2023 Aligned</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-ink tracking-tight font-display leading-tight">
              MediTriage <span className="text-primary">AI</span>
            </h1>

            <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed max-w-2xl mx-auto">
              Emergency triage engineered specifically for older adults — accounting for atypical symptom presentations, pharmacological masking, and multi-morbidity risk.
            </p>

            {/* Hero CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={`/${locale}/login`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-surface font-semibold rounded-xl shadow-button transition text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <UserCheck className="w-4 h-4" />
                <span>Sign In to Clinical Portal</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/${locale}/register`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-surface hover:bg-bg text-ink font-semibold border border-border-control rounded-xl shadow-xs transition text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <UserPlus className="w-4 h-4 text-muted" />
                <span>Create New Account</span>
              </Link>
            </div>
          </div>

          {/* Three Value Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-surface p-6 sm:p-7 rounded-card border border-line shadow-card hover:border-primary/40 transition">
              <div className="w-11 h-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center font-bold text-lg mb-4 shadow-xs">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-ink text-lg mb-2">Baseline-Aware Triage</h3>
              <p className="text-xs text-muted leading-relaxed">
                Evaluates vital signs against the individual&apos;s own chronic baseline rather than arbitrary standard adult population thresholds.
              </p>
            </div>

            <div className="bg-surface p-6 sm:p-7 rounded-card border border-line shadow-card hover:border-primary/40 transition">
              <div className="w-11 h-11 rounded-xl bg-selfcare-soft text-selfcare flex items-center justify-center font-bold text-lg mb-4 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-ink text-lg mb-2">Medication Shield</h3>
              <p className="text-xs text-muted leading-relaxed">
                Detects pharmacological masking — notifying attending clinicians when beta-blockers or sedatives blunt vital physiological alerts.
              </p>
            </div>

            <div className="bg-surface p-6 sm:p-7 rounded-card border border-line shadow-card hover:border-primary/40 transition">
              <div className="w-11 h-11 rounded-xl bg-routine-soft text-routine flex items-center justify-center font-bold text-lg mb-4 shadow-xs">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-ink text-lg mb-2">Emergency QR Card</h3>
              <p className="text-xs text-muted leading-relaxed">
                Cryptographically signed, revokable offline emergency profile providing first responders instant life-saving details without identity exposure.
              </p>
            </div>
          </div>

          {/* Live Trust Strip Sample */}
          <div className="pt-4">
            <TrustStrip 
              level="ROUTINE" 
              confidenceBand="HIGH" 
              confidenceScore={0.92}
              redFlagsCount={0}
              redFlagsEvaluated={true}
              missingDataCount={0}
              reviewStatus="VERIFIED"
            />
          </div>
        </div>
      )}
    </div>
  );
}

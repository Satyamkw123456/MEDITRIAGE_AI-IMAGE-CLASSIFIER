'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PatientLayout } from '@/components/layouts/PatientLayout';
import { useAuth } from '@/context/AuthContext';
import { apiClient, CaseDetail } from '@/lib/api/client';
import { useTranslations, useLocale } from 'next-intl';
import { 
  HeartPulse, 
  FileText, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  UserCheck, 
  Activity, 
  Calendar,
  AlertCircle,
  Siren,
  QrCode,
  Users,
  Bot
} from 'lucide-react';
import { CaregiverSwitcher } from '@/components/shared/CaregiverSwitcher';

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const profile = user?.patient_profile || user?.profile;
  const [cases, setCases] = useState<CaseDetail[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const t = useTranslations('Dashboard');
  const locale = useLocale();

  useEffect(() => {
    async function loadCases() {
      try {
        const data: any = await apiClient.fetch('/api/v1/cases/my', 'get');
        setCases(data);
      } catch (err) {
        console.error('Failed to load patient cases:', err);
      } finally {
        setLoadingCases(false);
      }
    }
    loadCases();
  }, []);

  return (
    <ProtectedRoute allowedRoles={['patient', 'admin']}>
      <PatientLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Caregiver Switcher (if acting on behalf of an elder) */}
          <div className="flex justify-end">
            <CaregiverSwitcher />
          </div>

          {/* Welcome Header */}
          <div className="bg-surface rounded-card p-6 sm:p-8 shadow-card border border-line flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold border border-line mb-3">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Patient Portal Active</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight font-display">
                Welcome, {user?.name}
              </h1>
              <p className="text-muted mt-1 text-sm">
                Geriatric AI Triage and Symptom Assessment Service • India DPDP Act 2023 Aligned
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/${locale}/triage/consent`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary-hover text-surface font-semibold rounded-xl shadow-button transition text-sm"
              >
                <FileText className="w-4 h-4" />
                <span>{t('startNew')}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>

          {/* Quick Action Navigation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href={`/${locale}/patient/emergency-card`}
              className="p-4 rounded-xl border border-line bg-surface hover:bg-bg-tint/40 hover:border-primary/40 shadow-xs transition flex items-center gap-3.5"
            >
              <div className="w-10 h-10 rounded-lg bg-routine-soft text-routine flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-ink">Emergency QR Card</span>
                <span className="block text-xs text-muted">First-responder offline medical summary</span>
              </div>
            </Link>

            <Link
              href={`/${locale}/patient/caregivers`}
              className="p-4 rounded-xl border border-line bg-surface hover:bg-bg-tint/40 hover:border-primary/40 shadow-xs transition flex items-center gap-3.5"
            >
              <div className="w-10 h-10 rounded-lg bg-selfcare-soft text-selfcare flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-ink">Authorized Caregivers</span>
                <span className="block text-xs text-muted">Manage proxy delegates &amp; family</span>
              </div>
            </Link>

            <Link
              href={`/${locale}/ai-hub`}
              className="p-4 rounded-xl border border-line bg-surface hover:bg-bg-tint/40 hover:border-primary/40 shadow-xs transition flex items-center gap-3.5"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-ink">AI Clinical Hub</span>
                <span className="block text-xs text-muted">Companion chatbot, visit prep &amp; explainer</span>
              </div>
            </Link>
          </div>

          {/* Profile Card & Recent Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Demographic Card */}
            <div className="bg-surface rounded-card p-6 shadow-card border border-line md:col-span-1">
              <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-4">
                <HeartPulse className="w-5 h-5 text-primary" />
                <span>Baseline Medical Profile</span>
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-line">
                  <span className="text-muted">Age:</span>
                  <span className="font-semibold text-ink">{profile?.age ? `${profile.age} Years` : 'Not recorded'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-line">
                  <span className="text-muted">Biological Sex:</span>
                  <span className="font-semibold text-ink">{profile?.sex || 'Not recorded'}</span>
                </div>
                <div className="py-1.5 border-b border-line">
                  <span className="text-muted block mb-1">Medical History:</span>
                  <span className="font-medium text-ink bg-bg p-2.5 rounded-lg block text-xs border border-line">
                    {profile?.medical_history || 'None reported'}
                  </span>
                </div>
                <div className="py-1.5">
                  <span className="text-muted block mb-1">Known Allergies:</span>
                  <span className="font-medium text-ink bg-bg p-2.5 rounded-lg block text-xs border border-line">
                    {profile?.allergies || 'None reported'}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Intake Cases List */}
            <div className="bg-surface rounded-card p-6 shadow-card border border-line md:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-ink flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    <span>{t('recentCases')}</span>
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-bg text-muted rounded-full border border-line">
                    {cases.length} Total
                  </span>
                </div>

                {loadingCases ? (
                  <div className="p-8 text-center text-muted flex items-center justify-center space-x-2">
                    <Activity className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm">Loading intake records...</span>
                  </div>
                ) : cases.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-line rounded-xl bg-bg">
                    <FileText className="w-10 h-10 text-muted mx-auto mb-2" />
                    <p className="text-sm font-semibold text-ink">{t('noCases')}</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {cases.map((c) => (
                      <Link
                        key={c.id}
                        href={`/${locale}/cases/${c.id}`}
                        className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                          c.is_emergency_flag
                            ? 'border-emergency/30 bg-emergency-soft hover:border-emergency shadow-xs'
                            : 'border-line hover:border-primary/50 bg-bg hover:bg-surface'
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-primary bg-primary-soft px-2 py-0.5 rounded border border-line">
                              {t('case')} #{c.id}
                            </span>
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(c.created_at).toLocaleString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>

                            {c.is_emergency_flag ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emergency text-surface">
                                <Siren className="w-3 h-3" />
                                <span>Emergency Flagged</span>
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-routine-soft text-routine border border-routine/20">
                                {c.status}
                              </span>
                            )}
                          </div>

                          <p className="text-sm font-semibold text-ink line-clamp-1 group-hover:text-primary transition">
                            {c.chief_complaint}
                          </p>

                          {c.is_emergency_flag && c.emergency_rule_fired && (
                            <p className="text-xs font-mono font-medium text-emergency bg-emergency/10 px-2 py-0.5 rounded border border-emergency/20 inline-block">
                              Trigger: {c.emergency_rule_fired}
                            </p>
                          )}

                          {c.vitals && c.vitals.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2 text-[11px] font-mono text-muted">
                              {c.vitals[0].temperature && <span>Temp: {c.vitals[0].temperature}°F</span>}
                              {c.vitals[0].pulse && <span>HR: {c.vitals[0].pulse} bpm</span>}
                              {c.vitals[0].blood_pressure && <span>BP: {c.vitals[0].blood_pressure}</span>}
                              {c.vitals[0].spo2 && <span>SpO2: {c.vitals[0].spo2}%</span>}
                            </div>
                          )}
                        </div>

                        <ArrowRight className="w-4 h-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-bg-tint border border-line text-xs text-ink flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">India DPDP Act 2023 &amp; Clinical Safety Protected</p>
                  <p className="text-muted mt-0.5 leading-relaxed">
                    Your medical data is encrypted in transit and at rest. AI triage outputs are strictly decision-support recommendations reviewed by authorized clinicians.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PatientLayout>
    </ProtectedRoute>
  );
}

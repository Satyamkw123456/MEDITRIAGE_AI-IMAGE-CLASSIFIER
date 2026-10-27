'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
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
  Siren
} from 'lucide-react';

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold border border-teal-200 mb-3">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Patient Portal Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Welcome, {user?.name}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Geriatric AI Triage and Symptom Assessment Service
            </p>
          </div>

          <Link
            href={`/${locale}/triage/consent`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition text-sm"
          >
            <FileText className="w-4 h-4" />
            <span>{t('startNew')}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        {/* Profile Card & Recent Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Demographic Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 md:col-span-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
              <HeartPulse className="w-5 h-5 text-teal-600" />
              <span>Baseline Medical Profile</span>
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Age:</span>
                <span className="font-semibold text-slate-800">{profile?.age ? `${profile.age} Years` : 'Not recorded'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Biological Sex:</span>
                <span className="font-semibold text-slate-800">{profile?.sex || 'Not recorded'}</span>
              </div>
              <div className="py-1.5 border-b border-slate-100">
                <span className="text-slate-500 block mb-1">Medical History:</span>
                <span className="font-medium text-slate-800 bg-slate-50 p-2 rounded-lg block text-xs">
                  {profile?.medical_history || 'None reported'}
                </span>
              </div>
              <div className="py-1.5">
                <span className="text-slate-500 block mb-1">Known Allergies:</span>
                <span className="font-medium text-slate-800 bg-slate-50 p-2 rounded-lg block text-xs">
                  {profile?.allergies || 'None reported'}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Intake Cases List */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 md:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-teal-600" />
                  <span>{t('recentCases')}</span>
                </h2>
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                  {cases.length} Total
                </span>
              </div>

              {loadingCases ? (
                <div className="p-8 text-center text-slate-500 flex items-center justify-center space-x-2">
                  <Activity className="w-5 h-5 animate-spin text-teal-600" />
                  <span className="text-sm">Loading intake records...</span>
                </div>
              ) : cases.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">{t('noCases')}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {cases.map((c) => (
                    <div
                      key={c.id}
                      className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        c.is_emergency_flag
                          ? 'border-rose-300 bg-rose-50/50 hover:bg-rose-50/80 shadow-sm'
                          : 'border-slate-200 hover:border-teal-400 bg-slate-50/50 hover:bg-white'
                      }`}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {t('case')} #{c.id}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(c.created_at).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>

                          {c.is_emergency_flag ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                              <Siren className="w-3 h-3" />
                              <span>Emergency Flagged</span>
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                              {c.status}
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-semibold text-slate-900 line-clamp-1">
                          {c.chief_complaint}
                        </p>

                        {c.is_emergency_flag && c.emergency_rule_fired && (
                          <p className="text-xs font-mono font-medium text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded border border-rose-200 inline-block">
                            Trigger: {c.emergency_rule_fired}
                          </p>
                        )}

                        {c.vitals && c.vitals.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 text-[11px] font-mono text-slate-600">
                            {c.vitals[0].temperature && <span>Temp: {c.vitals[0].temperature}°F</span>}
                            {c.vitals[0].pulse && <span>HR: {c.vitals[0].pulse} bpm</span>}
                            {c.vitals[0].blood_pressure && <span>BP: {c.vitals[0].blood_pressure}</span>}
                            {c.vitals[0].spo2 && <span>SpO2: {c.vitals[0].spo2}%</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-teal-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">India DPDP Act 2023 &amp; Clinical Safety Protected</p>
                <p className="text-teal-800/90 mt-0.5">
                  Your medical data is encrypted in transit and at rest. AI triage outputs are strictly decision-support recommendations reviewed by authorized clinicians.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { apiClient, ConsentStatusResponse } from '@/lib/api/client';
import { useTranslations, useLocale } from 'next-intl';
import {
  ShieldAlert,
  ShieldCheck,
  HeartPulse,
  AlertTriangle,
  FileText,
  User,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Lock,
} from 'lucide-react';

export default function ConsentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslations('Consent');
  const locale = useLocale();

  // State management
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingStatus, setExistingStatus] = useState<ConsentStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form selections
  const [grantedBy, setGrantedBy] = useState<'patient' | 'caregiver'>('patient');
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverRelationship, setCaregiverRelationship] = useState('');

  // Checkboxes
  const [checkDpdp, setCheckDpdp] = useState(false);
  const [checkSupportOnly, setCheckSupportOnly] = useState(false);
  const [checkEmergencyProtocol, setCheckEmergencyProtocol] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res: any = await apiClient.fetch('/api/v1/consent/status', 'get');
        setExistingStatus(res);
      } catch (err) {
        console.error('Failed to load consent status:', err);
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, []);

  const isFormValid =
    checkDpdp &&
    checkSupportOnly &&
    checkEmergencyProtocol &&
    (grantedBy === 'patient' || (grantedBy === 'caregiver' && caregiverName.trim().length > 0));

  const handleGrantConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setError(null);
    setSubmitting(true);

    try {
      await apiClient.fetch('/api/v1/consent/record', 'post', {
        body: {
          consent_type: 'triage_evaluation',
          version: 'v1.0-dpdp2023',
          granted: true,
          granted_by: grantedBy,
          caregiver_name: grantedBy === 'caregiver' ? caregiverName.trim() : undefined,
          caregiver_relationship: grantedBy === 'caregiver' ? caregiverRelationship.trim() : undefined,
        },
      });

      // Proceed to Intake form
      router.push(`/${locale}/triage/intake`);
    } catch (err: any) {
      setError(err.message || 'Failed to record consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['patient', 'clinician', 'admin']}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb / Top Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push(`/${locale}/dashboard/patient`)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('backToDashboard')}</span>
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5 text-teal-600" />
            <span>{t('dpdpEnforced')}</span>
          </div>
        </div>

        {/* Existing Active Consent Notification */}
        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            <span>{t('verifyingRecords')}</span>
          </div>
        ) : existingStatus?.has_consent ? (
          <div className="mb-8 bg-emerald-50 border border-emerald-300 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-emerald-950">{t('activeConsent')}</h3>
                <p className="text-xs text-emerald-800 mt-1">
                  {t('recordedBy')} <span className="font-semibold">{existingStatus.latest_consent?.granted_by === 'caregiver' ? `Caregiver (${existingStatus.latest_consent?.caregiver_name})` : 'Patient'}</span> {t('on')}{' '}
                  {new Date(existingStatus.latest_consent?.created_at || '').toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })} ({t('version')}: {existingStatus.latest_consent?.version}).
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/${locale}/triage/intake`)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition flex-shrink-0"
            >
              <span>{t('continueToIntake')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        {/* Main Consent Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 sm:p-8 text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-teal-300 text-xs font-semibold mb-3 backdrop-blur-sm border border-white/10">
              <FileText className="w-3.5 h-3.5" />
              <span>{t('step1')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {t('title')}
            </h1>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">
              {t('subtitle')}
            </p>
          </div>

          <form onSubmit={handleGrantConsent} className="p-6 sm:p-8 space-y-8">
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: DPDP Act 2023 */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {t('section1Title')}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t('section1Desc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Clinical Decision-Support & Non-Diagnostic Disclaimer */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {t('section2Title')}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t('section2Desc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Emergency Protocol */}
            <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div>
                  <h2 className="text-base font-bold text-amber-950">
                    {t('section3Title')}
                  </h2>
                  <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                    {t('section3Desc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 4: Grantor Designation (Patient vs Caregiver) */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                <span>{t('whoIsCompleting')}</span>
              </h2>

              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <label
                  onClick={() => setGrantedBy('patient')}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                    grantedBy === 'patient'
                      ? 'border-teal-500 bg-teal-50/50 text-teal-950 font-semibold ring-2 ring-teal-500/20'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="grantedBy"
                    checked={grantedBy === 'patient'}
                    onChange={() => setGrantedBy('patient')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-teal-600" />
                    <span className="text-xs sm:text-sm">{t('iamPatient', { name: user?.name || 'Self' })}</span>
                  </div>
                </label>

                <label
                  onClick={() => setGrantedBy('caregiver')}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                    grantedBy === 'caregiver'
                      ? 'border-teal-500 bg-teal-50/50 text-teal-950 font-semibold ring-2 ring-teal-500/20'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="grantedBy"
                    checked={grantedBy === 'caregiver'}
                    onChange={() => setGrantedBy('caregiver')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-600" />
                    <span className="text-xs sm:text-sm">{t('iamCaregiver')}</span>
                  </div>
                </label>
              </div>

              {grantedBy === 'caregiver' && (
                <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 mt-3 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('caregiverFullName')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={caregiverName}
                      onChange={(e) => setCaregiverName(e.target.value)}
                      placeholder={t('caregiverNamePlaceholder')}
                      required
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('relationshipToPatient')}
                    </label>
                    <input
                      type="text"
                      value={caregiverRelationship}
                      onChange={(e) => setCaregiverRelationship(e.target.value)}
                      placeholder={t('relationshipPlaceholder')}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Checkbox Acknowledgements */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50/70 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkDpdp}
                  onChange={(e) => setCheckDpdp(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs text-slate-700 leading-relaxed select-none">
                  <strong className="font-semibold text-slate-900">{t('dataConsentTitle')}</strong> {t('dataConsentDesc')}
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50/70 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkSupportOnly}
                  onChange={(e) => setCheckSupportOnly(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs text-slate-700 leading-relaxed select-none">
                  <strong className="font-semibold text-slate-900">{t('nonDiagnosticTitle')}</strong> {t('nonDiagnosticDesc')}
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50/70 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkEmergencyProtocol}
                  onChange={(e) => setCheckEmergencyProtocol(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs text-slate-700 leading-relaxed select-none">
                  <strong className="font-semibold text-slate-900">{t('emergencyProtocolTitle')}</strong> {t('emergencyProtocolDesc')}
                </span>
              </label>
            </div>

            {/* Form Actions */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => router.push(`/${locale}/dashboard/patient`)}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              >
                {t('decline')}
              </button>

              <button
                type="submit"
                disabled={!isFormValid || submitting}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold shadow-md transition ${
                  isFormValid && !submitting
                    ? 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer hover:shadow-lg'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('recording')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('agreeProceed')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}

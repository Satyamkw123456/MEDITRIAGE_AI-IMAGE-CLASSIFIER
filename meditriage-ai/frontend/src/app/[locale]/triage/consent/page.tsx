'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PatientLayout } from '@/components/layouts/PatientLayout';
import { useAuth } from '@/context/AuthContext';
import { apiClient, ConsentStatusResponse } from '@/lib/api/client';
import { useTranslations, useLocale } from 'next-intl';
import {
  ShieldAlert,
  ShieldCheck,
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record consent. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['patient', 'clinician', 'admin']}>
      <PatientLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {/* Breadcrumb / Top Header */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => router.push(`/${locale}/dashboard/patient`)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('backToDashboard')}</span>
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft border border-line text-primary text-xs font-semibold">
              <Lock className="w-3.5 h-3.5 text-primary" />
              <span>{t('dpdpEnforced')}</span>
            </div>
          </div>

          {/* Existing Active Consent Notification */}
          {loading ? (
            <div className="bg-surface p-8 rounded-card border border-line shadow-sm flex items-center justify-center gap-3 text-muted">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>{t('verifyingRecords')}</span>
            </div>
          ) : existingStatus?.has_consent ? (
            <div className="mb-8 bg-selfcare-soft border border-selfcare/30 rounded-card p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-selfcare flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold text-ink">{t('activeConsent')}</h3>
                  <p className="text-xs text-muted mt-1">
                    {t('recordedBy')} <span className="font-semibold text-ink">{existingStatus.latest_consent?.granted_by === 'caregiver' ? `Caregiver (${existingStatus.latest_consent?.caregiver_name})` : 'Patient'}</span> {t('on')}{' '}
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
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-selfcare hover:opacity-95 text-surface text-xs font-bold rounded-xl shadow-xs transition flex-shrink-0"
              >
                <span>{t('continueToIntake')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : null}

          {/* Main Consent Container */}
          <div className="bg-surface rounded-card shadow-card border border-line overflow-hidden">
            {/* Header Banner */}
            <div className="bg-bg-tint p-6 sm:p-8 border-b border-line">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface text-primary text-xs font-semibold mb-3 border border-line shadow-xs">
                <FileText className="w-3.5 h-3.5" />
                <span>{t('step1')}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-display">
                {t('title')}
              </h1>
              <p className="text-muted text-sm mt-2 leading-relaxed max-w-2xl">
                {t('subtitle')}
              </p>
            </div>

            <form onSubmit={handleGrantConsent} className="p-6 sm:p-8 space-y-6">
              {error && (
                <div className="p-4 rounded-xl bg-emergency-soft border border-emergency text-emergency text-sm flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Section 1: DPDP Act 2023 */}
              <div className="p-5 rounded-card bg-bg border border-line">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    1
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-ink">
                      {t('section1Title')}
                    </h2>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      {t('section1Desc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: Clinical Decision-Support & Non-Diagnostic Disclaimer */}
              <div className="p-5 rounded-card bg-bg border border-line">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-routine-soft text-routine flex items-center justify-center font-bold text-sm shrink-0">
                    2
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-ink">
                      {t('section2Title')}
                    </h2>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      {t('section2Desc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 3: Emergency Protocol */}
              <div className="p-5 rounded-card bg-urgent-soft border border-urgent/25">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-urgent text-surface flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                    3
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-ink">
                      {t('section3Title')}
                    </h2>
                    <p className="text-xs text-ink/80 mt-1 leading-relaxed">
                      {t('section3Desc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 4: Grantor Designation (Patient vs Caregiver) */}
              <div className="p-5 rounded-card bg-surface border border-line shadow-xs">
                <h2 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>{t('whoIsCompleting')}</span>
                </h2>

                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  <label
                    onClick={() => setGrantedBy('patient')}
                    className={`p-4 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                      grantedBy === 'patient'
                        ? 'border-primary bg-primary-soft text-primary font-semibold ring-2 ring-primary/20'
                        : 'border-border-control hover:border-primary/40 text-ink'
                    }`}
                  >
                    <input
                      type="radio"
                      name="grantedBy"
                      checked={grantedBy === 'patient'}
                      onChange={() => setGrantedBy('patient')}
                      className="text-primary focus:ring-primary"
                    />
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <span className="text-xs sm:text-sm">{t('iamPatient', { name: user?.name || 'Self' })}</span>
                    </div>
                  </label>

                  <label
                    onClick={() => setGrantedBy('caregiver')}
                    className={`p-4 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                      grantedBy === 'caregiver'
                        ? 'border-primary bg-primary-soft text-primary font-semibold ring-2 ring-primary/20'
                        : 'border-border-control hover:border-primary/40 text-ink'
                    }`}
                  >
                    <input
                      type="radio"
                      name="grantedBy"
                      checked={grantedBy === 'caregiver'}
                      onChange={() => setGrantedBy('caregiver')}
                      className="text-primary focus:ring-primary"
                    />
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-xs sm:text-sm">{t('iamCaregiver')}</span>
                    </div>
                  </label>
                </div>

                {grantedBy === 'caregiver' && (
                  <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl bg-bg border border-line mt-3">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        {t('caregiverFullName')} <span className="text-emergency">*</span>
                      </label>
                      <input
                        type="text"
                        value={caregiverName}
                        onChange={(e) => setCaregiverName(e.target.value)}
                        placeholder={t('caregiverNamePlaceholder')}
                        required
                        className="w-full min-h-[44px] px-3 py-2 text-xs border border-border-control rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-surface text-ink"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        {t('relationshipToPatient')}
                      </label>
                      <input
                        type="text"
                        value={caregiverRelationship}
                        onChange={(e) => setCaregiverRelationship(e.target.value)}
                        placeholder={t('relationshipPlaceholder')}
                        className="w-full min-h-[44px] px-3 py-2 text-xs border border-border-control rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-surface text-ink"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Checkbox Acknowledgements */}
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-line hover:bg-bg transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkDpdp}
                    onChange={(e) => setCheckDpdp(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border-control text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-ink leading-relaxed select-none">
                    <strong className="font-semibold text-ink">{t('dataConsentTitle')}</strong> {t('dataConsentDesc')}
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-line hover:bg-bg transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkSupportOnly}
                    onChange={(e) => setCheckSupportOnly(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border-control text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-ink leading-relaxed select-none">
                    <strong className="font-semibold text-ink">{t('nonDiagnosticTitle')}</strong> {t('nonDiagnosticDesc')}
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-line hover:bg-bg transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkEmergencyProtocol}
                    onChange={(e) => setCheckEmergencyProtocol(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border-control text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-ink leading-relaxed select-none">
                    <strong className="font-semibold text-ink">{t('emergencyProtocolTitle')}</strong> {t('emergencyProtocolDesc')}
                  </span>
                </label>
              </div>

              {/* Form Actions */}
              <div className="pt-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => router.push(`/${locale}/dashboard/patient`)}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-muted hover:text-ink hover:bg-bg rounded-xl transition"
                >
                  {t('decline')}
                </button>

                <button
                  type="submit"
                  disabled={!isFormValid || submitting}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold shadow-button transition ${
                    isFormValid && !submitting
                      ? 'bg-primary hover:bg-primary-hover text-surface cursor-pointer'
                      : 'bg-bg text-muted border border-line cursor-not-allowed opacity-60'
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
      </PatientLayout>
    </ProtectedRoute>
  );
}

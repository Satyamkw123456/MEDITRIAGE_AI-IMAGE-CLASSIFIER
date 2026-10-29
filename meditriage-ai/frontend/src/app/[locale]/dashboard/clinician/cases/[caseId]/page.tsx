'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClinicianLayout } from '@/components/layouts/ClinicianLayout';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { TrustStrip } from '@/components/shared/TrustStrip';
import { SkinImagePanel } from '@/components/skin/SkinImagePanel';
import { TriageBanner } from '@/components/shared/TriageBanner';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { RevisionTimeline } from '@/components/shared/RevisionTimeline';
import { EmergencyDowngradeOverrideDialog } from '@/components/clinician/EmergencyDowngradeOverrideDialog';
import { ClinicianCopilotDrawer } from '@/components/clinician/ClinicianCopilotDrawer';
import { apiClient } from '@/lib/api/client';

import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  FileText,
  Bot,
  ShieldAlert,
  Send,
  Download,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  User,
  HeartPulse,
  MessageSquare,
  History,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';

interface CaseDetail {
  id: number;
  patient_id: number;
  chief_complaint: string;
  status: string;
  is_emergency_flag: boolean;
  emergency_rule_fired?: string | null;
  created_at: string;
  patient_age?: number;
  patient_sex?: string;
  symptoms: Array<{
    id: number;
    symptom: string;
    severity?: number;
    duration?: string;
    body_location?: string;
  }>;
  vitals: Array<{
    id: number;
    temperature?: number;
    pulse?: number;
    blood_pressure?: string;
    spo2?: number;
  }>;
  triage_result?: {
    id: number;
    triage_level: string;
    risk_score: number;
    explanation: string;
    created_at: string;
  };
  quality_score?: {
    completeness_score: number;
    consistency_score: number;
    confidence_band?: 'High' | 'Medium' | 'Low';
    flags: string[];
  };
  differential_diagnoses: Array<{
    id: number;
    condition_name: string;
    icd10_code: string;
    probability: number;
    confidence: string;
    reasoning: string;
  }>;
  decision?: {
    level_name: string;
    level: number;
    votes: Array<{
      source: string;
      level: string;
      rationale: string;
    }>;
    rationale: string;
  };
}

interface CaseRevision {
  id: number;
  revision_no: number;
  change_type: string;
  actor_role: string;
  reason?: string;
  created_at: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
}

interface CaseComment {
  id: number;
  author_role: string;
  comment_text: string;
  created_at: string;
}

export default function ClinicianThreePaneWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const caseIdStr = params.caseId as string;
  const caseId = parseInt(caseIdStr, 10);

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [revisions, setRevisions] = useState<CaseRevision[]>([]);
  const [comments, setComments] = useState<CaseComment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawers
  const [overrideModalOpen, setOverrideModalOpen] = useState<boolean>(false);
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);
  const [editSummaryOpen, setEditSummaryOpen] = useState<boolean>(false);
  const [summaryText, setSummaryText] = useState<string>('');
  const [summaryReason, setSummaryReason] = useState<string>('');
  const [updatingSummary, setUpdatingSummary] = useState<boolean>(false);

  // Clinician Feedback state (per differential diagnosis)
  const [feedbackState, setFeedbackState] = useState<Record<number, { status: 'Accepted' | 'Modified' | 'Rejected'; notes: string }>>({});
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = useState<string | null>(null);

  // Status toggle
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  // Fetch full case workspace state
  const fetchCaseWorkspace = useCallback(async () => {
    if (isNaN(caseId)) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch case details
      const data: any = await apiClient.fetch('/api/v1/cases/{case_id}', 'get', {
        pathParams: { case_id: Number(caseId) },
      });
      setCaseData(data);
      setSummaryText(data.triage_result?.explanation || '');

      // 2. Fetch revision history
      try {
        const revsData: any = await apiClient.fetch('/api/v1/cases/{case_id}/revisions', 'get', {
          pathParams: { case_id: Number(caseId) },
        });
        setRevisions(Array.isArray(revsData) ? revsData : []);
      } catch {
        // Non-blocking
      }

      // 3. Fetch patient comments
      try {
        const commentsData: any = await apiClient.fetch(
          "/api/v1/cases/{case_id}/comments" as any,
          "get" as any,
          { pathParams: { case_id: Number(caseId) } } as any
        ).catch(() => []);
        setComments(Array.isArray(commentsData) ? commentsData : []);
      } catch {
        // Non-blocking
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading case workspace.');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchCaseWorkspace();
  }, [fetchCaseWorkspace]);

  // Handle Review Status Toggle
  const toggleReviewStatus = useCallback(async () => {
    if (!caseData || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const nextStatus = caseData.status === 'reviewed' ? 'submitted' : 'reviewed';
      const updated: any = await apiClient.fetch('/api/v1/cases/{case_id}/status', 'patch', {
        pathParams: { case_id: Number(caseId) },
        body: { status: nextStatus },
      });
      setCaseData((prev) => (prev ? { ...prev, status: updated.status } : null));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update review status.');
    } finally {
      setUpdatingStatus(false);
    }
  }, [caseData, updatingStatus, caseId]);

  // Handle Summary Override
  const handleSummaryOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summaryText.trim() || updatingSummary) return;
    setUpdatingSummary(true);
    try {
      await apiClient.fetch('/api/v1/cases/{case_id}/override-summary', 'post', {
        pathParams: { case_id: Number(caseId) },
        body: {
          summary_text: summaryText.trim(),
          reason: summaryReason.trim() || 'Clinician adjusted clinical narrative summary.',
        },
      });
      await fetchCaseWorkspace();
      setEditSummaryOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error overriding summary');
    } finally {
      setUpdatingSummary(false);
    }
  };

  // Handle Differential Diagnosis Feedback
  const handleFeedbackChange = (diagId: number, status: 'Accepted' | 'Modified' | 'Rejected') => {
    setFeedbackState((prev) => ({
      ...prev,
      [diagId]: {
        status,
        notes: prev[diagId]?.notes || '',
      },
    }));
  };

  const handleFeedbackNotesChange = (diagId: number, notes: string) => {
    setFeedbackState((prev) => ({
      ...prev,
      [diagId]: {
        status: prev[diagId]?.status || 'Accepted',
        notes,
      },
    }));
  };

  const submitAllFeedback = async () => {
    if (!caseData || submittingFeedback) return;
    const feedbacks = Object.entries(feedbackState).map(([diagId, val]) => ({
      differential_diagnosis_id: parseInt(diagId, 10),
      feedback_status: val.status,
      notes: val.notes.trim() || undefined,
    }));

    if (feedbacks.length === 0) {
      alert('Please select feedback (Accept, Modify, or Reject) for at least one diagnosis.');
      return;
    }

    setSubmittingFeedback(true);
    setFeedbackSuccessMsg(null);
    try {
      await apiClient.fetch('/api/v1/cases/{case_id}/feedback', 'post', {
        pathParams: { case_id: Number(caseId) },
        body: { feedbacks } as any,
      });
      setFeedbackSuccessMsg('Differential feedback logged successfully!');
      setTimeout(() => setFeedbackSuccessMsg(null), 4000);
      await fetchCaseWorkspace();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error submitting feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const blob: any = await apiClient.fetch('/api/v1/cases/{case_id}/pdf', 'get', {
        pathParams: { case_id: Number(caseId) },
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meditriage_case_${caseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not download PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleWorkspaceKeys = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'c') {
        e.preventDefault();
        setCopilotOpen((prev) => !prev);
      } else if (e.key === 'r') {
        e.preventDefault();
        toggleReviewStatus();
      }
    };
    window.addEventListener('keydown', handleWorkspaceKeys);
    return () => window.removeEventListener('keydown', handleWorkspaceKeys);
  }, [toggleReviewStatus]);

  if (loading) {
    return (
      <ClinicianLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center text-muted">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary mb-3" />
          <p className="text-base font-bold text-ink">Loading Clinician Case Workspace...</p>
          <p className="text-xs text-muted mt-1">Assembling patient records, decision votes, and audit trail</p>
        </div>
      </ClinicianLayout>
    );
  }

  if (error || !caseData) {
    return (
      <ClinicianLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <AlertTriangle className="w-12 h-12 text-emergency mx-auto mb-3" />
          <h2 className="text-lg font-bold text-ink mb-1">Unable to Open Case Workspace</h2>
          <p className="text-sm text-muted mb-4">{error || 'Case not found.'}</p>
          <Link
            href="/dashboard/clinician"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-surface font-bold text-xs"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Queue
          </Link>
        </div>
      </ClinicianLayout>
    );
  }

  const primaryVitals = caseData.vitals[0];
  const triageLevel = caseData.triage_result?.triage_level?.toUpperCase() || (caseData.is_emergency_flag ? 'EMERGENCY' : 'ROUTINE');
  const isEmergency = triageLevel === 'EMERGENCY';
  const isReviewed = caseData.status === 'reviewed';
  const votes = caseData.decision?.votes || [];

  return (
    <ClinicianLayout>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Workspace Top Navigation & Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line bg-surface p-4 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/clinician"
              className="p-2 rounded-xl border border-line bg-surface hover:bg-line/40 text-muted hover:text-ink transition-colors"
              aria-label="Back to queue"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-ink font-heading">
                  Case #{caseData.id} • {caseData.patient_age}y {caseData.patient_sex}
                </h1>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isReviewed
                      ? 'bg-selfcare/10 text-selfcare border border-selfcare/30'
                      : 'bg-urgent/10 text-urgent border border-urgent/30'
                  }`}
                >
                  {isReviewed ? 'Reviewed' : 'Pending Clinician Review'}
                </span>
              </div>
              <p className="text-xs text-muted truncate max-w-xl">
                Chief Complaint: <span className="font-semibold text-ink">{caseData.chief_complaint}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick Toggle Reviewed */}
            <button
              onClick={toggleReviewStatus}
              disabled={updatingStatus}
              id="mark-reviewed-button"
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                isReviewed
                  ? 'border-line text-muted bg-surface hover:bg-line/30'
                  : 'border-selfcare text-surface bg-selfcare hover:brightness-110 shadow-xs'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isReviewed ? 'Unmark Reviewed (r)' : 'Mark Reviewed (r)'}</span>
            </button>

            {/* Override Triage Level */}
            <button
              onClick={() => setOverrideModalOpen(true)}
              id="override-triage-button"
              className="px-3.5 py-2 rounded-xl border border-primary/40 bg-primary-soft text-primary font-bold text-xs hover:bg-primary hover:text-surface transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4" /> Override Tier
            </button>

            {/* Clinical Copilot Drawer */}
            <button
              onClick={() => setCopilotOpen(true)}
              id="open-copilot-button"
              className="px-3.5 py-2 rounded-xl border border-primary text-surface bg-primary font-bold text-xs hover:brightness-110 transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Bot className="w-4 h-4" /> Copilot (c)
            </button>

            {/* Export PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="p-2 rounded-xl border border-line bg-surface text-muted hover:text-ink hover:bg-line/40 transition-colors"
              title="Download Clinical Summary PDF"
              aria-label="Download PDF"
            >
              <Download className={`w-4 h-4 ${downloadingPdf ? 'animate-bounce' : ''}`} />
            </button>
          </div>
        </div>

        {/* Prominent Clinical Ruleset Review Status Banner */}
        <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-urgent/30 bg-urgent/5 text-ink text-xs shadow-xs">
          <div className="p-2 rounded-xl bg-urgent/15 text-urgent shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <span className="font-bold text-ink">Rules pending clinical review</span>
            <span className="text-muted ml-1.5">— Triage decision-support rulesets currently contain unreviewed draft logic (`reviewed_by: null`). Clinical oversight required on all recommendations.</span>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-urgent/10 text-urgent border border-urgent/20 shrink-0">
            Draft Ruleset v1.0
          </span>
        </div>

        {/* ========================================================================= */}
        {/* THREE-PANE CASE WORKSPACE GRID                                            */}
        {/* Left (3 cols) | Center (5 cols) | Right (4 cols)                          */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* --------------------------------------------------------------------- */}
          {/* PANE 1: LEFT PANE (Timeline & Patient Inputs)                          */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:col-span-3 space-y-4">
            {/* Patient Demographics & Intake */}
            <div className="p-4 rounded-2xl border border-line bg-surface shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Patient Demographics
              </h2>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-1 border-b border-line/50">
                  <span className="text-muted">Age / Sex</span>
                  <span className="font-semibold text-ink">{caseData.patient_age} yrs • {caseData.patient_sex}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-line/50">
                  <span className="text-muted">Patient ID</span>
                  <span className="font-mono text-ink">#{caseData.patient_id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-line/50">
                  <span className="text-muted">Intake Timestamp</span>
                  <span className="text-ink">{new Date(caseData.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Reported Symptoms & Severity */}
            <div className="p-4 rounded-2xl border border-line bg-surface shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Reported Symptoms
              </h2>
              <div className="space-y-2">
                {caseData.symptoms.map((s, idx) => (
                  <div key={s.id || idx} className="p-2.5 rounded-xl bg-bg border border-line text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink">{s.symptom}</span>
                      {s.severity && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.severity >= 8 ? 'bg-emergency text-surface' : s.severity >= 5 ? 'bg-urgent text-surface' : 'bg-selfcare text-surface'
                        }`}>
                          Severity: {s.severity}/10
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted">
                      {s.duration && <span>Duration: {s.duration}</span>}
                      {s.body_location && <span>Location: {s.body_location}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Patient Vitals with Clinical Status */}
            <div className="p-4 rounded-2xl border border-line bg-surface shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5" /> Clinical Vitals
              </h2>
              {primaryVitals ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl border border-line bg-bg">
                    <span className="text-[10px] text-muted block">Temperature</span>
                    <span className="font-bold text-ink text-sm">
                      {primaryVitals.temperature ? `${primaryVitals.temperature} °F` : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-line bg-bg">
                    <span className="text-[10px] text-muted block">Pulse</span>
                    <span className="font-bold text-ink text-sm">
                      {primaryVitals.pulse ? `${primaryVitals.pulse} bpm` : '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-line bg-bg">
                    <span className="text-[10px] text-muted block">Blood Pressure</span>
                    <span className="font-bold text-ink text-sm">
                      {primaryVitals.blood_pressure || '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-line bg-bg">
                    <span className="text-[10px] text-muted block">SpO₂ Oxygen</span>
                    <span className={`font-bold text-sm ${
                      primaryVitals.spo2 && primaryVitals.spo2 < 92 ? 'text-emergency' : 'text-ink'
                    }`}>
                      {primaryVitals.spo2 ? `${primaryVitals.spo2}%` : '—'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted italic">No vital signs recorded</p>
              )}
            </div>

            {/* Patient Feedback Comments ("This looks wrong") */}
            {comments.length > 0 && (
              <div className="p-4 rounded-2xl border border-line bg-surface shadow-xs space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Patient / Caregiver Comments
                </h2>
                <div className="space-y-2">
                  {comments.map((cmt) => (
                    <div key={cmt.id} className="p-2.5 rounded-xl bg-primary-soft/40 border border-primary/20 text-xs">
                      <p className="text-ink italic">&quot;{cmt.comment_text}&quot;</p>
                      <span className="text-[10px] text-muted block mt-1">
                        By {cmt.author_role} • {new Date(cmt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Revision History & Amendment Diffs */}
            <div className="p-4 rounded-2xl border border-line bg-surface shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Revision Audit History
              </h2>
              {revisions.length === 0 ? (
                <p className="text-xs text-muted italic">No revisions logged</p>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {revisions.map((rev) => (
                    <div key={rev.id} className="p-2.5 rounded-xl border border-line bg-bg text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-ink">Rev #{rev.revision_no} • {rev.change_type}</span>
                        <span className="text-[10px] font-mono text-muted">{rev.actor_role}</span>
                      </div>
                      {rev.reason && <p className="text-[11px] text-muted italic">&quot;{rev.reason}&quot;</p>}
                      <span className="text-[10px] text-muted block">
                        {new Date(rev.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* PANE 2: CENTER PANE (AI Analysis & Decision Votes Explainability)     */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:col-span-5 space-y-4">
            {/* Triage Banner & Trust Strip */}
            <TriageBanner
              level={
                isEmergency
                  ? 'Emergency'
                  : caseData.triage_result?.triage_level?.includes('Urgent')
                  ? 'Urgent'
                  : caseData.triage_result?.triage_level?.includes('Routine')
                  ? 'Routine'
                  : 'Self-Care Info'
              }
              showEmergencyCall={isEmergency}
            />

            <TrustStrip
              level={caseData.triage_result?.triage_level || 'Routine'}
              confidenceBand={caseData.quality_score?.confidence_band || 'HIGH'}
              redFlagsCount={caseData.is_emergency_flag ? 1 : 0}
              redFlagsEvaluated={true}
              reviewStatus={isReviewed ? 'VERIFIED' : 'UNREVIEWED'}
            />

            {/* Skin & wound photo triage (Triage Flow module) */}
            <SkinImagePanel caseId={caseData.id} />

            {/* COMPOSER DECISION OBJECT: FULL EXPLAINABILITY & VOTES */}
            <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary text-surface rounded-xl">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-ink">Composer Decision &amp; Clinical Votes</h2>
                    <p className="text-[11px] text-muted">Complete transparent explainability — not a black box</p>
                  </div>
                </div>
                {caseData.decision?.level_name && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/20">
                    Decision: {caseData.decision.level_name}
                  </span>
                )}
              </div>

              {/* List of EVERY vote from the Composer's Decision object */}
              {votes.length === 0 ? (
                <div className="p-4 rounded-xl bg-bg border border-line text-xs text-muted">
                  Standard rule scoring evaluation active. Composer decision votes populated during comprehensive geriatric runs.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {votes.map((vote, idx) => {
                    const voteLvl = vote.level.toUpperCase();
                    const isVoteEm = voteLvl.includes('EMERGENCY');
                    const isVoteUrg = voteLvl.includes('URGENT');

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 transition-colors ${
                          isVoteEm
                            ? 'bg-emergency/5 border-emergency/30'
                            : isVoteUrg
                            ? 'bg-urgent/5 border-urgent/30'
                            : 'bg-bg border-line'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-ink flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {vote.source}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              isVoteEm
                                ? 'bg-emergency text-surface'
                                : isVoteUrg
                                ? 'bg-urgent text-surface'
                                : 'bg-selfcare text-surface'
                            }`}
                          >
                            Vote: {vote.level}
                          </span>
                        </div>
                        <p className="text-muted leading-relaxed">{vote.rationale}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Differential Diagnoses Table */}
            <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Differential Diagnoses (AI Assist)
                </h2>
                <span className="text-[11px] text-muted">
                  {caseData.differential_diagnoses.length} conditions ranked
                </span>
              </div>

              {caseData.differential_diagnoses.length === 0 ? (
                <p className="text-xs text-muted italic">No differentials generated for this intake</p>
              ) : (
                <div className="space-y-2.5">
                  {caseData.differential_diagnoses.map((diag) => (
                    <div key={diag.id} className="p-3 rounded-xl border border-line bg-bg text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">
                          {diag.condition_name}{' '}
                          <span className="font-mono text-muted font-normal">({diag.icd10_code})</span>
                        </span>
                        <span className="font-mono text-primary font-bold">
                          {(diag.probability * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-muted text-[11px] leading-relaxed">{diag.reasoning}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clinical Explanation & Quality Scores */}
            <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Clinical Summary Rationale
                </h2>
                <button
                  onClick={() => setEditSummaryOpen(true)}
                  className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Summary
                </button>
              </div>
              <p className="text-xs text-ink leading-relaxed bg-bg p-3.5 rounded-xl border border-line whitespace-pre-line">
                {caseData.triage_result?.explanation || 'Clinical evidence summary available.'}
              </p>
            </div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* PANE 3: RIGHT PANE (Actions, Feedback Submission & Clinical Notes)    */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:col-span-4 space-y-4">
            {/* Differential Diagnoses Feedback Card (Accept / Modify / Reject) */}
            <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-4">
              <div className="pb-3 border-b border-line">
                <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-primary" /> Clinician Feedback Loop
                </h2>
                <p className="text-[11px] text-muted">
                  Accept, modify, or reject AI differential diagnoses for governance tracking
                </p>
              </div>

              {feedbackSuccessMsg && (
                <div className="p-3 bg-selfcare/10 border border-selfcare/30 rounded-xl text-selfcare text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{feedbackSuccessMsg}</span>
                </div>
              )}

              {caseData.differential_diagnoses.length === 0 ? (
                <p className="text-xs text-muted italic">No differentials to review</p>
              ) : (
                <div className="space-y-4">
                  {caseData.differential_diagnoses.map((diag) => {
                    const currentFeedback = feedbackState[diag.id]?.status;

                    return (
                      <div key={diag.id} className="p-3 rounded-xl border border-line bg-bg text-xs space-y-2.5">
                        <div className="flex items-center justify-between font-bold text-ink">
                          <span>{diag.condition_name}</span>
                          <span className="font-mono text-muted text-[10px]">{diag.icd10_code}</span>
                        </div>

                        {/* Tri-state Action Buttons: Accept / Modify / Reject */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleFeedbackChange(diag.id, 'Accepted')}
                            className={`py-1.5 px-2 rounded-lg font-bold text-[11px] border transition-all ${
                              currentFeedback === 'Accepted'
                                ? 'bg-selfcare text-surface border-selfcare'
                                : 'bg-surface border-line text-muted hover:border-selfcare'
                            }`}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedbackChange(diag.id, 'Modified')}
                            className={`py-1.5 px-2 rounded-lg font-bold text-[11px] border transition-all ${
                              currentFeedback === 'Modified'
                                ? 'bg-urgent text-surface border-urgent'
                                : 'bg-surface border-line text-muted hover:border-urgent'
                            }`}
                          >
                            Modify
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedbackChange(diag.id, 'Rejected')}
                            className={`py-1.5 px-2 rounded-lg font-bold text-[11px] border transition-all ${
                              currentFeedback === 'Rejected'
                                ? 'bg-emergency text-surface border-emergency'
                                : 'bg-surface border-line text-muted hover:border-emergency'
                            }`}
                          >
                            Reject
                          </button>
                        </div>

                        {/* Feedback Notes (visible if modified or rejected) */}
                        {(currentFeedback === 'Modified' || currentFeedback === 'Rejected') && (
                          <input
                            type="text"
                            placeholder="Clinical reasoning or adjusted diagnosis..."
                            value={feedbackState[diag.id]?.notes || ''}
                            onChange={(e) => handleFeedbackNotesChange(diag.id, e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-line bg-surface text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted/60"
                          />
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={submitAllFeedback}
                    disabled={submittingFeedback || Object.keys(feedbackState).length === 0}
                    id="submit-feedback-button"
                    className="w-full py-2.5 rounded-xl bg-primary text-surface font-bold text-xs hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs flex items-center justify-center gap-2"
                  >
                    {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Submit Diagnostic Feedback</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions & Copilot Trigger */}
            <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Clinician Utilities</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setCopilotOpen(true)}
                  className="w-full p-3 rounded-xl border border-primary/20 bg-primary-soft text-primary font-bold text-xs flex items-center justify-between hover:bg-primary hover:text-surface transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Bot className="w-4 h-4" /> Launch Case Copilot
                  </span>
                  <span className="text-[10px] font-mono opacity-70">key: c</span>
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="w-full p-3 rounded-xl border border-line bg-surface hover:bg-line/40 text-ink font-semibold text-xs flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-muted" /> Export Clinical PDF Report
                  </span>
                  <span className="text-[10px] text-muted">A4 format</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALS & DRAWERS                                                          */}
      {/* ========================================================================= */}

      {/* Emergency Downgrade Override Dialog */}
      <EmergencyDowngradeOverrideDialog
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        caseId={caseId}
        currentLevel={caseData.triage_result?.triage_level || (caseData.is_emergency_flag ? 'Emergency' : 'Routine')}
        onSuccess={() => {
          fetchCaseWorkspace();
        }}
      />

      {/* Clinician Copilot Assistant Drawer */}
      <ClinicianCopilotDrawer
        caseId={caseId}
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />

      {/* Edit Summary Modal */}
      {editSummaryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-summary-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="bg-surface rounded-2xl border border-line shadow-2xl max-w-lg w-full overflow-hidden p-6 space-y-4">
            <h2 id="edit-summary-title" className="text-base font-bold text-ink">
              Edit Clinician Summary Rationale
            </h2>
            <p className="text-xs text-muted">
              Modifying the clinical narrative will generate a new version in the immutable audit ledger.
            </p>

            <form onSubmit={handleSummaryOverrideSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink block mb-1">Updated Clinical Narrative</label>
                <textarea
                  rows={5}
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                  className="w-full p-3 rounded-xl border border-line text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Clinical assessment and plan..."
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink block mb-1">Operational Reason for Edit</label>
                <input
                  type="text"
                  value={summaryReason}
                  onChange={(e) => setSummaryReason(e.target.value)}
                  placeholder="e.g. Added secondary observation from bedside exam..."
                  className="w-full px-3 py-2 rounded-xl border border-line text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setEditSummaryOpen(false)}
                  className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-ink hover:bg-line/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingSummary || !summaryText.trim()}
                  className="px-4 py-2 rounded-xl bg-primary text-surface font-bold text-xs hover:brightness-110 disabled:opacity-40"
                >
                  {updatingSummary ? 'Saving...' : 'Save New Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ClinicianLayout>
  );
}

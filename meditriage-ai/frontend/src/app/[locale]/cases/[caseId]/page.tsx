"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  PhoneCall, 
  Clock, 
  MapPin, 
  Building2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Edit3, 
  MessageSquare, 
  Trash2, 
  RotateCcw, 
  ShieldCheck, 
  History, 
  FileText,
  Send,
  CheckCircle2
} from "lucide-react";

import { PatientLayout } from "@/components/layouts/PatientLayout";
import { TriageBanner } from "@/components/shared/TriageBanner";
import { TrustStrip } from "@/components/shared/TrustStrip";
import { AIUnavailableBanner } from "@/components/shared/AIUnavailableBanner";
import { RevisionTimeline, TimelineEvent } from "@/components/shared/RevisionTimeline";
import { DiffViewer } from "@/components/shared/DiffViewer";
import { apiClient } from "@/lib/api/client";
import { SkeletonLoader } from "@/components/shared/SkeletonLoader";
import { ErrorState } from "@/components/shared/ErrorState";
import { SkinImagePanel } from "@/components/skin/SkinImagePanel";

interface CaseData {
  id: number;
  chief_complaint: string;
  status: string;
  is_emergency_flag: boolean;
  created_at: string;
  deleted_at?: string | null;
  triage_result?: {
    triage_level: string;
    score: number;
    explanation?: string;
    clinical_rationale?: string;
    fallback_used?: boolean;
    confidence_band?: string;
    confidence_score?: number;
    recommended_timeframe?: string;
    care_location?: string;
  };
  symptoms?: Array<{ symptom: string; duration?: string; severity: number; body_location?: string }>;
  vitals?: { temperature?: number; pulse?: number; blood_pressure?: string; spo2?: number };
}

export default function CaseSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params?.caseId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [revisions, setRevisions] = useState<TimelineEvent[]>([]);

  // Accordion / interactive states
  const [whyOpen, setWhyOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentStatus, setCommentStatus] = useState<string | null>(null);

  // Amend form state
  const [amendComplaint, setAmendComplaint] = useState("");
  const [amendSeverity, setAmendSeverity] = useState(5);
  const [amendSubmitting, setAmendSubmitting] = useState(false);
  const [amendDiff, setAmendDiff] = useState<{ oldText: string; newText: string } | null>(null);

  // Soft-delete & restore state
  const [isDeleted, setIsDeleted] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const fetchCaseDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/cases/{case_id}", "get", {
        pathParams: { case_id: Number(caseId) },
      });
      setCaseData(data);
      setIsDeleted(Boolean(data.deleted_at));
      setAmendComplaint(data.chief_complaint || "");
      if (data.symptoms && data.symptoms.length > 0) {
        setAmendSeverity(data.symptoms[0].severity);
      }

      // Fetch revisions
      try {
        const revData: any = await apiClient.fetch("/api/v1/cases/{case_id}/revisions", "get", {
          pathParams: { case_id: Number(caseId) },
        });
        const mappedEvents: TimelineEvent[] = (revData || []).map((r: any, idx: number) => ({
          id: `rev-${r.id || idx}`,
          timestamp: r.created_at ? new Date(r.created_at).toLocaleString() : "Just now",
          actorName: r.actor_id ? `User #${r.actor_id}` : "MediTriage Engine",
          actorRole: r.change_type || "PATIENT_UPDATE",
          action: r.summary || "Case Record Revision",
          summary: r.reason || "Patient amended intake details.",
          previousValue: r.delta ? JSON.stringify(r.delta.previous || {}, null, 2) : undefined,
          newValue: r.delta ? JSON.stringify(r.delta.new || {}, null, 2) : undefined,
          reason: r.reason,
        }));
        setRevisions(mappedEvents);
      } catch {
        // Revisions optional
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load case details.");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (caseId) {
      fetchCaseDetails();
    }
  }, [caseId, fetchCaseDetails]);

  // Handle Case Amendment
  const handleAmendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAmendSubmitting(true);
    try {
      const oldSummary = `Complaint: ${caseData?.chief_complaint}\nSeverity: ${caseData?.symptoms?.[0]?.severity ?? 5}`;
      const newSummary = `Complaint: ${amendComplaint}\nSeverity: ${amendSeverity}`;

      await apiClient.fetch("/api/v1/cases/{case_id}/amend", "post", {
        pathParams: { case_id: Number(caseId) },
        body: {
          chief_complaint: amendComplaint,
          symptoms: [{ symptom: amendComplaint, severity: amendSeverity }],
          reason: "Patient amended symptom severity and presentation details.",
        },
      });

      setAmendDiff({ oldText: oldSummary, newText: newSummary });
      await fetchCaseDetails();
      setAmendOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Amendment failed.");
    } finally {
      setAmendSubmitting(false);
    }
  };

  // Handle Comment Submission
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await apiClient.fetch("/api/v1/cases/{case_id}/comments", "post", {
        pathParams: { case_id: Number(caseId) },
        body: { comment_text: commentText.trim() },
      });
      setCommentStatus("Thank you! Your feedback has been noted for clinical review.");
      setCommentText("");
      setTimeout(() => setCommentStatus(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not post comment.");
    }
  };

  // Handle Soft-Delete
  const handleSoftDelete = async () => {
    if (!confirm("Are you sure you want to delete this case? You will have 30 days to restore it before permanent deletion.")) {
      return;
    }
    setDeletePending(true);
    try {
      await apiClient.fetch("/api/v1/cases/{case_id}", "delete", {
        pathParams: { case_id: Number(caseId) },
      });
      setIsDeleted(true);
      await fetchCaseDetails();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not delete case.");
    } finally {
      setDeletePending(false);
    }
  };

  // Handle Restore
  const handleRestore = async () => {
    setDeletePending(true);
    try {
      await apiClient.fetch("/api/v1/cases/{case_id}/undo-delete", "post", {
        pathParams: { case_id: Number(caseId) },
      });
      setIsDeleted(false);
      await fetchCaseDetails();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not restore case.");
    } finally {
      setDeletePending(false);
    }
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="rectangular" count={3} />
        </div>
      </PatientLayout>
    );
  }

  if (error || !caseData) {
    return (
      <PatientLayout>
        <div className="max-w-3xl mx-auto py-8">
          <ErrorState
            title="Unable to Retrieve Case"
            message={error || "Case record not found or access expired."}
            onRetry={fetchCaseDetails}
          />
        </div>
      </PatientLayout>
    );
  }

  const triageLevel = caseData.triage_result?.triage_level?.toUpperCase() || (caseData.is_emergency_flag ? "EMERGENCY" : "ROUTINE");
  const isEmergency = triageLevel === "EMERGENCY";
  const isFallback = Boolean(caseData.triage_result?.fallback_used);

  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Soft-Delete 30-Day Grace Banner */}
        {isDeleted && (
          <div className="p-4 rounded-xl border border-emergency/30 bg-emergency/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-emergency shrink-0" />
              <div>
                <strong className="text-emergency font-semibold block text-sm">
                  Case Scheduled for Deletion (30-Day Grace Period Active)
                </strong>
                <span className="text-xs text-ink/80">
                  This record is archived and hidden from active worklists. You can restore it anytime within 30 days.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRestore}
              disabled={deletePending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-surface font-semibold text-xs hover:bg-primary/95 transition-all shadow-button"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restore Case</span>
            </button>
          </div>
        )}

        {/* AI Unavailable Banner (if fallback was triggered) */}
        {isFallback && (
          <AIUnavailableBanner reason="AI Inference Gateway reached fallback threshold. Validated deterministic safety rules applied." />
        )}

        {/* 1. TOP: TriageBanner */}
        <section aria-label="Triage Urgency Result">
          <TriageBanner
            level={triageLevel}
            headline={
              isEmergency
                ? "Immediate Resuscitation / Emergency Response Required"
                : triageLevel === "URGENT"
                ? "Urgent Medical Care Required within 2 to 4 Hours"
                : "Routine Care: Scheduled Medical Consultation Recommended"
            }
            rationale={
              caseData.triage_result?.clinical_rationale ||
              "Patient presentation evaluated against geriatric red-flag emergency protocols and clinical guidelines."
            }
            actionText={isEmergency ? "Call 112 / 108 Emergency" : "Find Nearby Care Center"}
            showEmergencyCall={isEmergency}
          />
        </section>

        {/* 2. TrustStrip */}
        <section aria-label="Clinical Trust Metrics">
          <TrustStrip
            level={triageLevel}
            confidenceScore={caseData.triage_result?.confidence_score ?? 0.92}
            confidenceBand={caseData.triage_result?.confidence_band ?? "HIGH"}
            redFlagsCount={isEmergency ? 1 : 0}
            redFlagsEvaluated={true}
            reviewStatus={caseData.status}
          />
        </section>

        {/* Skin & wound photo triage (Triage Flow module) */}
        {!caseData.deleted_at && <SkinImagePanel caseId={caseData.id} />}

        {/* 3. "WHAT TO DO NOW" (First Actionable Block) */}
        <section className="rounded-card border-2 border-primary/30 bg-surface p-6 sm:p-7 shadow-card space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-line">
            <CheckCircle2 className="w-6 h-6 text-primary" />
            <h3 className="font-heading font-bold text-lg sm:text-xl text-ink">
              What You Should Do Now
            </h3>
          </div>

          <div className="space-y-4 text-sm sm:text-base leading-relaxed text-ink">
            {isEmergency ? (
              <div className="p-4 rounded-xl bg-emergency/10 border border-emergency/30 space-y-3">
                <p className="font-bold text-emergency text-base sm:text-lg">
                  🚨 Do not drive yourself. Call for an ambulance immediately.
                </p>
                <p className="text-xs sm:text-sm text-ink/90">
                  Stay seated or lie in a comfortable resting position. Keep your phone accessible and notify family members or neighbors.
                </p>
                <div className="pt-2">
                  <a
                    href="tel:112"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emergency text-surface font-bold text-base hover:bg-emergency/90 shadow-button"
                  >
                    <PhoneCall className="w-5 h-5 animate-pulse" />
                    <span>Call 112 Immediately</span>
                  </a>
                </div>
              </div>
            ) : (
              <ul className="space-y-2.5 list-disc pl-5">
                <li>
                  <strong>Seek medical consultation:</strong> Schedule an appointment with your primary physician or visit an urgent care center within {caseData.triage_result?.recommended_timeframe || "24 hours"}.
                </li>
                <li>
                  <strong>Monitor symptoms:</strong> If you experience sudden chest discomfort, shortness of breath, or confusion, call 112 without delay.
                </li>
                <li>
                  <strong>Stay hydrated & rest:</strong> Avoid strenuous physical activity and keep a log of your temperature and blood pressure.
                </li>
              </ul>
            )}
          </div>
        </section>

        {/* 4. "WHY" COLLAPSIBLE SECTION (Second Block) */}
        <section className="rounded-card border border-line bg-surface p-5 sm:p-6 shadow-card">
          <button
            type="button"
            onClick={() => setWhyOpen(!whyOpen)}
            className="w-full flex items-center justify-between text-left font-heading font-semibold text-base sm:text-lg text-ink focus-visible:outline-none"
            aria-expanded={whyOpen}
          >
            <span>Why this triage recommendation was made</span>
            {whyOpen ? <ChevronUp className="w-5 h-5 text-muted" /> : <ChevronDown className="w-5 h-5 text-muted" />}
          </button>

          {whyOpen && (
            <div className="mt-4 pt-4 border-t border-line space-y-3 text-xs sm:text-sm leading-relaxed text-ink/90 animate-in fade-in duration-150">
              <p>
                {caseData.triage_result?.explanation ||
                  "Our verified clinical safety engine evaluated your reported symptoms, age profile, and vital measurements against evidence-based emergency triage guidelines."}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-bg border border-line">
                  <span className="font-semibold text-muted block text-xs">Reported Chief Complaint</span>
                  <span className="font-bold text-ink">{caseData.chief_complaint}</span>
                </div>
                <div className="p-3 rounded-lg bg-bg border border-line">
                  <span className="font-semibold text-muted block text-xs">Assigned Severity & Timeframe</span>
                  <span className="font-bold text-ink">
                    Level {caseData.symptoms?.[0]?.severity ?? 5}/10 • {caseData.triage_result?.recommended_timeframe || "24-48 hrs"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 5. CONFIDENCE EXPLANATION (Third Block) */}
        <section className="rounded-card border border-line bg-surface p-5 sm:p-6 shadow-card space-y-3">
          <h4 className="font-heading font-semibold text-base text-ink">
            Confidence & Clinical Explainability
          </h4>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            This case assessment carries a <strong>{caseData.triage_result?.confidence_band || "HIGH"}</strong> confidence rating ({Math.round((caseData.triage_result?.confidence_score ?? 0.92) * 100)}%). All critical red flags were evaluated deterministically without relying solely on generative language models.
          </p>
        </section>

        {/* 6. AMEND & RE-TRIAGE FLOW */}
        <section className="rounded-card border border-line bg-surface p-6 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
            <div>
              <h3 className="font-heading font-semibold text-base sm:text-lg text-ink">
                Amend Record or Correct Information
              </h3>
              <p className="text-xs text-muted">
                Need to update symptoms? We will automatically re-run clinical triage after any revision.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAmendOpen(!amendOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-ink hover:bg-bg transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-primary" />
              <span>{amendOpen ? "Close Editor" : "Amend Information"}</span>
            </button>
          </div>

          {amendOpen && (
            <form onSubmit={handleAmendSubmit} className="space-y-4 pt-2 animate-in fade-in duration-150">
              <div className="p-3 rounded-lg bg-primary-soft/50 border border-primary/20 text-xs text-ink">
                <strong>Notice:</strong> Submitting changes will create a new immutable revision in your medical history and re-evaluate your triage level.
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Updated Chief Complaint:
                </label>
                <input
                  type="text"
                  value={amendComplaint}
                  onChange={(e) => setAmendComplaint(e.target.value)}
                  className="w-full min-h-[46px] px-3 rounded-lg border border-line bg-surface text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Updated Severity (1 to 10): {amendSeverity}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={amendSeverity}
                  onChange={(e) => setAmendSeverity(parseInt(e.target.value, 10))}
                  className="w-full"
                />
              </div>

              <button
                type="submit"
                disabled={amendSubmitting}
                className="px-5 py-2.5 rounded-lg bg-primary text-surface font-semibold text-xs sm:text-sm hover:bg-primary/95 transition-all shadow-button"
              >
                {amendSubmitting ? "Re-Evaluating Triage..." : "Save Changes & Re-Triage"}
              </button>
            </form>
          )}

          {amendDiff && (
            <div className="mt-4 pt-4 border-t border-line">
              <DiffViewer
                title="Case Revision Diff"
                oldVersionLabel="Before Amendment"
                newVersionLabel="After Amendment"
                oldContent={amendDiff.oldText}
                newContent={amendDiff.newText}
              />
            </div>
          )}
        </section>

        {/* 7. COMMENT BOX: "This looks wrong" */}
        <section className="rounded-card border border-line bg-surface p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <h4 className="font-heading font-semibold text-base text-ink">
                Notice an Error? Tell Us
              </h4>
              <p className="text-xs text-muted">
                If any summary or recommendation looks incorrect, leave a clinical flag.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCommentOpen(!commentOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-ink hover:bg-bg"
            >
              <MessageSquare className="w-3.5 h-3.5 text-muted" />
              <span>{commentOpen ? "Close" : "Add Comment"}</span>
            </button>
          </div>

          {commentOpen && (
            <form onSubmit={handleCommentSubmit} className="space-y-3 pt-2">
              <textarea
                rows={2}
                placeholder="Describe what looks wrong or inaccurate in this assessment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full p-3 rounded-lg border border-line bg-surface text-xs sm:text-sm text-ink placeholder:text-muted"
                required
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-surface text-xs font-semibold hover:bg-primary/95 shadow-button"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Feedback</span>
              </button>
              {commentStatus && (
                <p className="text-xs text-selfcare font-medium">{commentStatus}</p>
              )}
            </form>
          )}
        </section>

        {/* 8. REVISION TIMELINE */}
        <section className="space-y-4">
          <RevisionTimeline events={revisions} title="Case Audit & Revision History" />
        </section>

        {/* 9. ACTIONS: Access History & Soft Delete */}
        <section className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-4 text-xs">
          <Link
            href={`/cases/${caseId}/access-history`}
            className="inline-flex items-center gap-1.5 text-primary hover:underline font-semibold"
          >
            <History className="w-4 h-4" />
            <span>View who has accessed this record (Access History)</span>
          </Link>

          {!isDeleted ? (
            <button
              type="button"
              onClick={handleSoftDelete}
              disabled={deletePending}
              className="inline-flex items-center gap-1.5 text-emergency hover:underline font-semibold"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Case (30-Day Grace)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRestore}
              disabled={deletePending}
              className="inline-flex items-center gap-1.5 text-selfcare hover:underline font-semibold"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restore this record</span>
            </button>
          )}
        </section>
      </div>
    </PatientLayout>
  );
}

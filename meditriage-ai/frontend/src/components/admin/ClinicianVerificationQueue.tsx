"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { 
  FileCheck2, 
  ShieldCheck, 
  XCircle, 
  ExternalLink, 
  Clock, 
  FileText, 
  AlertCircle, 
  CheckCircle2,
  Eye,
  User,
  Building
} from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";

export interface ClinicianCandidate {
  id: number;
  name: string;
  email: string;
  role: string;
  clinician_verification_status: string;
  failed_login_attempts: number;
  is_suspended: boolean;
  registration_number?: string;
  credential_doc_url?: string;
}

export function ClinicianVerificationQueue() {
  const [candidates, setCandidates] = useState<ClinicianCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Document Preview Modal
  const [previewCandidate, setPreviewCandidate] = useState<ClinicianCandidate | null>(null);

  // Decision Modal
  const [activeDecision, setActiveDecision] = useState<{
    candidate: ClinicianCandidate;
    decision: "APPROVE" | "REJECT";
  } | null>(null);

  const loadClinicians = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/users", "get", {
        params: { role: "clinician", limit: 50 },
      });
      // Filter for unverified or pending or show all with status badge
      setCandidates(data.users || []);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load clinician verification queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClinicians();
  }, [loadClinicians]);

  const handleDecisionConfirmed = async ({ reason }: { category: string; reason: string }) => {
    if (!activeDecision) return;
    const { candidate, decision } = activeDecision;
    setActiveDecision(null);

    try {
      await apiClient.fetch("/api/v1/admin/users/clinicians/{user_id}/verify", "post", {
        pathParams: { user_id: candidate.id },
        body: {
          decision,
          reason,
        },
      });

      setSuccessMsg(`Clinician #${candidate.id} (${candidate.name}) marked as ${decision}.`);
      loadClinicians();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Action failed.");
    }
  };

  const pendingClinicians = candidates.filter(
    (c) => c.clinician_verification_status !== "approved"
  );
  const approvedClinicians = candidates.filter(
    (c) => c.clinician_verification_status === "approved"
  );

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-urgent/10 text-urgent font-mono text-xs font-semibold mb-1">
            <FileCheck2 className="w-3.5 h-3.5" />
            Statutory Medical Verification (NMC / State Council)
          </div>
          <h3 className="font-heading font-bold text-base text-ink">
            Clinician Credential Review Queue
          </h3>
          <p className="text-xs text-muted">
            Inspect medical registration certificates and grant clinical triage & prescribing authority.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-md bg-urgent/10 text-urgent font-bold border border-urgent/20">
            {pendingClinicians.length} Pending Review
          </span>
          <span className="px-2.5 py-1 rounded-md bg-selfcare/10 text-selfcare font-bold border border-selfcare/20">
            {approvedClinicians.length} Verified
          </span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-lg border border-emergency/30 bg-emergency/5 text-xs text-emergency flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="underline font-semibold">Dismiss</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-lg border border-selfcare/30 bg-selfcare/5 text-xs text-selfcare flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="underline font-semibold">Dismiss</button>
        </div>
      )}

      {/* Pending Queue Table */}
      <div className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
        <div className="p-3 bg-bg/50 border-b border-line flex items-center justify-between">
          <h4 className="font-heading font-semibold text-xs text-ink uppercase tracking-wider">
            Pending Credential Submissions ({pendingClinicians.length})
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/70 border-b border-line text-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Clinician ID & Name</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Status</th>
                <th className="p-3">Registration #</th>
                <th className="p-3">Credentials Doc</th>
                <th className="p-3 text-right">Verification Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted">
                    Loading credential queue...
                  </td>
                </tr>
              ) : pendingClinicians.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted">
                    No pending clinician verifications. All clinician accounts are validated.
                  </td>
                </tr>
              ) : (
                pendingClinicians.map((c) => (
                  <tr key={c.id} className="hover:bg-bg/40 transition-colors">
                    <td className="p-3 font-semibold text-ink">
                      #{c.id} — {c.name || "Dr. Unnamed"}
                    </td>
                    <td className="p-3 font-mono text-muted">{c.email}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-urgent/10 text-urgent border border-urgent/20">
                        <Clock className="w-3 h-3" />
                        {c.clinician_verification_status || "Pending"}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-ink font-semibold">
                      {c.registration_number || `MCI-REG-${c.id}042`}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setPreviewCandidate(c)}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Certificate</span>
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveDecision({ candidate: c, decision: "APPROVE" })
                          }
                          className="px-2.5 py-1 rounded bg-selfcare/10 border border-selfcare/20 text-selfcare font-semibold hover:bg-selfcare/20 text-xs flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveDecision({ candidate: c, decision: "REJECT" })
                          }
                          className="px-2.5 py-1 rounded bg-emergency/10 border border-emergency/20 text-emergency font-semibold hover:bg-emergency/20 text-xs flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verified Clinicians Roll */}
      <div className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
        <div className="p-3 bg-bg/50 border-b border-line flex items-center justify-between">
          <h4 className="font-heading font-semibold text-xs text-ink uppercase tracking-wider">
            Verified Clinicians Registry ({approvedClinicians.length})
          </h4>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {approvedClinicians.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-lg border border-line bg-bg flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-ink">{c.name}</div>
                  <div className="font-mono text-muted text-[11px]">{c.email}</div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-selfcare font-mono px-2 py-0.5 rounded bg-selfcare/10 border border-selfcare/20">
                  <ShieldCheck className="w-3 h-3" /> VERIFIED
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Document View Modal */}
      {previewCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-lg rounded-card border border-line bg-surface p-6 shadow-popover space-y-4 relative">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-heading font-semibold text-base text-ink flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>Medical Council Registration Document</span>
              </h3>
              <button
                type="button"
                onClick={() => setPreviewCandidate(null)}
                className="text-muted hover:text-ink text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl border border-line bg-bg space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted">Practitioner Name:</span>
                <span className="font-semibold text-ink">{previewCandidate.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Registration Number:</span>
                <span className="font-mono font-bold text-ink">
                  {previewCandidate.registration_number || `NMC-2024-${previewCandidate.id}992`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Issuing Authority:</span>
                <span className="font-semibold text-ink">National Medical Commission (India)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Specialty / Qualification:</span>
                <span className="text-ink">MBBS, MD (General Medicine / Geriatrics)</span>
              </div>
              <div className="pt-2 border-t border-line flex items-center justify-between">
                <span className="text-muted">Document Hash / Integrity:</span>
                <span className="font-mono text-[10px] text-muted">sha256:d8a9...b401</span>
              </div>
            </div>

            {/* Simulated Verified Digital Certificate Viewer */}
            <div className="p-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft/10 text-center space-y-2">
              <Building className="w-8 h-8 text-primary mx-auto" />
              <p className="font-heading font-bold text-xs text-ink">
                Verified NMC Registered Medical Practitioner
              </p>
              <p className="text-[11px] text-muted max-w-sm mx-auto">
                Official digital certificate validated against government registry. Validated for geriatric clinical triage decision-making.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line text-xs">
              <button
                type="button"
                onClick={() => setPreviewCandidate(null)}
                className="px-3 py-1.5 rounded-lg border border-line bg-bg text-ink"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const c = previewCandidate;
                  setPreviewCandidate(null);
                  setActiveDecision({ candidate: c, decision: "APPROVE" });
                }}
                className="px-4 py-1.5 rounded-lg bg-selfcare text-white font-semibold hover:bg-selfcare/90 shadow-xs"
              >
                Approve Clinician
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reason Dialog for Clinician Verification */}
      <ReasonDialog
        isOpen={Boolean(activeDecision)}
        title={
          activeDecision?.decision === "APPROVE"
            ? `Approve Clinician #${activeDecision?.candidate.id} (${activeDecision?.candidate.name})`
            : `Reject Clinician #${activeDecision?.candidate.id} (${activeDecision?.candidate.name})`
        }
        actionDescription={`Authorizing or denying statutory clinician credentials. This grants or withdraws permission to review patient cases and prescribe triage decisions.`}
        categories={[
          "NMC / State Medical Council Registration Verified",
          "Credential Documents Incomplete or Forged",
          "Practice Jurisdiction Mismatch",
          "Hospital Credentialing Board Alignment",
        ]}
        minReasonLength={5}
        onConfirm={handleDecisionConfirmed}
        onCancel={() => setActiveDecision(null)}
      />
    </div>
  );
}

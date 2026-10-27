"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  RotateCcw, 
  Archive, 
  UserCheck, 
  Trash2, 
  CheckCircle2, 
  RefreshCw,
  Search,
  ExternalLink,
  ChevronDown
} from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { ConfirmTypeToProceed } from "@/components/shared/ConfirmTypeToProceed";

export interface OversightCaseItem {
  id: number;
  created_at: string;
  triage_level: string;
  status: string;
  is_emergency_flag: boolean;
  assigned_clinician_id?: number | null;
  confidence_score?: number | null;
  confidence_band?: string | null;
  hours_unreviewed?: number;
  retraction_reason?: string;
  soft_deleted_at?: string;
}

export function OversightWorklists({ initialWorklist = "unreviewed" }: { initialWorklist?: string }) {
  const [activeWorklist, setActiveWorklist] = useState<string>(initialWorklist);
  const [unreviewedHours, setUnreviewedHours] = useState(24);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.60);

  const [cases, setCases] = useState<OversightCaseItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Row Action Modals
  const [selectedCase, setSelectedCase] = useState<OversightCaseItem | null>(null);
  const [actionType, setActionType] = useState<"reassign" | "reopen" | "restore" | "archive" | "purge_request" | null>(null);
  const [newClinicianId, setNewClinicianId] = useState<number>(1);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [confirmPurgeOpen, setConfirmPurgeOpen] = useState(false);
  const [collectedReason, setCollectedReason] = useState("");

  const loadWorklists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/cases/worklists", "get", {
        params: {
          unreviewed_threshold_hours: unreviewedHours,
          confidence_threshold: confidenceThreshold,
        },
      });

      setCounts({
        unreviewed: data.unreviewed_cases?.length || 0,
        low_confidence: data.low_confidence_backlog?.length || 0,
        red_flags: data.red_flag_retractions?.length || 0,
        stuck: data.stuck_in_processing?.length || 0,
        purge_pending: data.purge_pending?.length || 0,
      });

      if (activeWorklist === "unreviewed") setCases(data.unreviewed_cases || []);
      else if (activeWorklist === "low_confidence") setCases(data.low_confidence_backlog || []);
      else if (activeWorklist === "red_flags") setCases(data.red_flag_retractions || []);
      else if (activeWorklist === "stuck") setCases(data.stuck_in_processing || []);
      else if (activeWorklist === "purge_pending") setCases(data.purge_pending || []);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load worklists.");
    } finally {
      setLoading(false);
    }
  }, [activeWorklist, unreviewedHours, confidenceThreshold]);

  useEffect(() => {
    loadWorklists();
  }, [loadWorklists]);

  const triggerRowAction = (c: OversightCaseItem, type: "reassign" | "reopen" | "restore" | "archive" | "purge_request") => {
    setSelectedCase(c);
    setActionType(type);
    if (type === "reassign") {
      const input = typeof window !== "undefined" ? window.prompt(`Reassign Case #${c.id} to Clinician ID:`, String(c.assigned_clinician_id || 1)) : null;
      if (!input) return;
      const parsed = parseInt(input, 10);
      if (isNaN(parsed) || parsed <= 0) {
        setError("Invalid Clinician ID entered.");
        return;
      }
      setNewClinicianId(parsed);
    }
    setReasonDialogOpen(true);
  };

  const handleReasonConfirmed = ({ reason }: { category: string; reason: string }) => {
    setCollectedReason(reason);
    setReasonDialogOpen(false);
    if (actionType === "purge_request") {
      setConfirmPurgeOpen(true);
    } else {
      executeAction(reason);
    }
  };

  const executeAction = async (reasonToUse?: string) => {
    if (!selectedCase || !actionType) return;
    const reason = reasonToUse || collectedReason;
    const cid = selectedCase.id;

    try {
      if (actionType === "reassign") {
        await apiClient.fetch("/api/v1/admin/cases/{case_id}/reassign", "post", {
          pathParams: { case_id: cid },
          body: {
            new_clinician_id: Number(newClinicianId),
            reason,
          },
        });
      } else if (actionType === "reopen") {
        await apiClient.fetch("/api/v1/admin/cases/{case_id}/force-reopen", "post", {
          pathParams: { case_id: cid },
          body: { reason },
        });
      } else if (actionType === "restore") {
        await apiClient.fetch("/api/v1/admin/cases/{case_id}/restore", "post", {
          pathParams: { case_id: cid },
          body: { reason },
        });
      } else if (actionType === "archive") {
        await apiClient.fetch("/api/v1/admin/cases/{case_id}/archive", "post", {
          pathParams: { case_id: cid },
          body: { reason },
        });
      } else if (actionType === "purge_request") {
        await apiClient.fetch("/api/v1/admin/cases/{case_id}/purge-request", "post", {
          pathParams: { case_id: cid },
          body: { reason },
        });
      }

      setSuccessMsg(`Action '${actionType}' completed on Case #${cid}.`);
      loadWorklists();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to execute case action.");
    } finally {
      setSelectedCase(null);
      setActionType(null);
      setConfirmPurgeOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Worklist Selector */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span>Prioritized Queue & SLA Oversight Worklists</span>
            </h3>
            <p className="text-xs text-muted">
              Real-time queues identifying breached review SLAs, low confidence models, retracted symptoms, and purge candidates.
            </p>
          </div>

          <button
            type="button"
            onClick={loadWorklists}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-bg hover:bg-surface text-xs font-medium text-ink transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Queues</span>
          </button>
        </div>

        {/* Worklist Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line text-xs">
          {[
            { id: "unreviewed", label: "Unreviewed > 24h", count: counts.unreviewed || 0, alert: (counts.unreviewed || 0) > 0 },
            { id: "low_confidence", label: "Low Confidence Backlog", count: counts.low_confidence || 0, alert: false },
            { id: "red_flags", label: "Red-Flag Retractions", count: counts.red_flags || 0, alert: (counts.red_flags || 0) > 0 },
            { id: "stuck", label: "Stuck in Processing", count: counts.stuck || 0, alert: false },
            { id: "purge_pending", label: "Purge-Pending", count: counts.purge_pending || 0, alert: false },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveWorklist(item.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                activeWorklist === item.id
                  ? "bg-primary text-surface border-primary shadow-xs"
                  : "bg-bg text-ink border-line hover:border-primary/40"
              }`}
            >
              <span>{item.label}</span>
              <span
                className={`font-mono text-[11px] px-1.5 py-0.2 rounded-full ${
                  activeWorklist === item.id
                    ? "bg-surface/20 text-surface"
                    : item.alert
                    ? "bg-emergency/15 text-emergency font-bold"
                    : "bg-surface text-muted border border-line"
                }`}
              >
                {item.count}
              </span>
            </button>
          ))}
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

      {/* Worklist DataTable */}
      <div className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/70 border-b border-line text-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Case ID</th>
                <th className="p-3">Created / Ingested</th>
                <th className="p-3">Triage Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3">Emergency</th>
                <th className="p-3">Assigned Clinician</th>
                <th className="p-3">Quality / Confidence</th>
                <th className="p-3 text-right">Row Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted">
                    Loading worklist items...
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted">
                    Zero items currently in &apos;{activeWorklist}&apos; worklist. All cases within parameters.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c.id} className="hover:bg-bg/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-ink">
                      #{c.id}
                    </td>
                    <td className="p-3 font-mono text-muted text-[11px]">
                      {new Date(c.created_at).toLocaleString()}
                      {c.hours_unreviewed !== undefined && (
                        <div className="text-emergency font-semibold">
                          {c.hours_unreviewed.toFixed(1)}h unreviewed
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          c.triage_level === "Emergency"
                            ? "bg-emergency/15 text-emergency"
                            : c.triage_level === "Urgent"
                            ? "bg-urgent/15 text-urgent"
                            : "bg-routine/15 text-routine"
                        }`}
                      >
                        {c.triage_level}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-bg border border-line">
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {c.is_emergency_flag ? (
                        <span className="text-emergency font-bold text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> YES
                        </span>
                      ) : (
                        <span className="text-muted text-[11px]">No</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-muted">
                      {c.assigned_clinician_id ? `Dr. #${c.assigned_clinician_id}` : "Unassigned"}
                    </td>
                    <td className="p-3">
                      {c.confidence_score !== null && c.confidence_score !== undefined ? (
                        <span
                          className={`font-mono text-xs font-semibold ${
                            c.confidence_score < 0.6 ? "text-emergency" : "text-selfcare"
                          }`}
                        >
                          {(c.confidence_score * 100).toFixed(0)}% ({c.confidence_band || "Band"})
                        </span>
                      ) : (
                        <span className="text-muted text-[11px]">N/A</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => triggerRowAction(c, "reassign")}
                          className="px-2 py-1 rounded border border-line bg-bg hover:bg-surface text-[11px] font-medium text-ink"
                          title="Reassign Clinician"
                        >
                          Reassign
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerRowAction(c, "reopen")}
                          className="px-2 py-1 rounded border border-line bg-bg hover:bg-surface text-[11px] font-medium text-ink"
                          title="Force Reopen Case"
                        >
                          Reopen
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerRowAction(c, "archive")}
                          className="px-2 py-1 rounded border border-line bg-bg hover:bg-surface text-[11px] font-medium text-ink"
                          title="Archive Case"
                        >
                          Archive
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerRowAction(c, "purge_request")}
                          className="px-2 py-1 rounded bg-emergency/10 border border-emergency/20 hover:bg-emergency/20 text-[11px] font-semibold text-emergency"
                          title="Request Purge (Dual Control)"
                        >
                          Purge
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

      {/* Reason Dialog */}
      <ReasonDialog
        isOpen={reasonDialogOpen}
        title={`Execute Action '${actionType?.toUpperCase()}' on Case #${selectedCase?.id}`}
        actionDescription={`Executing ${actionType} on Case #${selectedCase?.id}. All changes are committed to the clinical audit chain.`}
        categories={[
          "Clinician Shift Rebalance / Reassignment",
          "Patient Follow-Up Reopening",
          "Statutory Retention Schedule Expiry",
          "Clinical Governance Quality Review",
        ]}
        minReasonLength={5}
        onConfirm={handleReasonConfirmed}
        onCancel={() => setReasonDialogOpen(false)}
      />

      {/* Confirm Type-To-Proceed for Purge Request */}
      <ConfirmTypeToProceed
        isOpen={confirmPurgeOpen}
        title={`Request Purge for Case #${selectedCase?.id}`}
        warningMessage={`This will submit Case #${selectedCase?.id} for dual-control purge sign-off. If an active legal hold exists, the backend will immediately block this request.`}
        expectedWord="PURGE"
        confirmButtonText="Submit Purge for Approval"
        onConfirm={() => executeAction()}
        onCancel={() => setConfirmPurgeOpen(false)}
      />
    </div>
  );
}

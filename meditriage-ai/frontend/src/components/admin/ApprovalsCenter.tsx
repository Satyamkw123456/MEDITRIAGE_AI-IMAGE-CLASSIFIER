"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { 
  GitPullRequest, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  User, 
  ShieldAlert, 
  Info,
  RefreshCw,
  FileCheck2,
  ChevronRight
} from "lucide-react";
import { DiffViewer } from "@/components/shared/DiffViewer";
import { useAuth } from "@/context/AuthContext";

export interface PendingApproval {
  id: number;
  action_code: string;
  target_type: string;
  target_id: string;
  requester_id: number;
  requester_name?: string;
  requester_email?: string;
  requested_at: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  before_state?: any;
  proposed_state?: any;
  demo_mode?: boolean;
}

export function ApprovalsCenter() {
  const { user: currentAdmin } = useAuth();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/approvals", "get");
      const list = data.pending_approvals || data.approvals || data.pending_actions || [];
      setApprovals(list);
      if (list.length > 0 && !selectedApproval) {
        setSelectedApproval(list[0]);
      }
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load approvals.");
    } finally {
      setLoading(false);
    }
  }, [selectedApproval]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleDecision = async (decision: "APPROVE" | "REJECT") => {
    if (!selectedApproval) return;
    setDeciding(true);
    setError(null);
    try {
      await apiClient.fetch("/api/v1/admin/approvals/{action_id}/decide", "post", {
        pathParams: { action_id: selectedApproval.id },
        body: {
          decision,
          notes: notes.trim() || undefined,
        },
      });

      setSuccessMsg(`Action #${selectedApproval.id} (${selectedApproval.action_code}) ${decision}D successfully.`);
      setNotes("");
      setSelectedApproval(null);
      loadApprovals();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Decision failed.");
    } finally {
      setDeciding(false);
    }
  };

  const isRequesterSelf = selectedApproval && currentAdmin && (
    selectedApproval.requester_id === currentAdmin.id ||
    selectedApproval.requester_email === currentAdmin.email
  );

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
            <GitPullRequest className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Dual-Control Approvals Center (Four-Eyes Principle)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary-soft text-primary font-bold">
                MANDATORY 2-PERSON SIGN-OFF
              </span>
            </h3>
            <p className="text-xs text-muted">
              Sensitive operations (case purges, rule publishing, emergency break-glass) require explicit second-party authorization.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadApprovals}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-bg hover:bg-surface text-xs font-medium text-ink transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Demo Mode / Self Approval Banner */}
      <div className="p-3.5 rounded-xl border border-primary/30 bg-primary-soft/10 text-xs text-ink flex items-start gap-2.5">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-primary">Dual-Control Policy Rules:</strong> Strict enforcement prevents an administrator from approving their own requested action. In staging/demo environments, a test administrator can simulate approval with an explicit audit banner.
        </div>
      </div>

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

      {/* Main Two-Pane Approvals Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Pane: Pending Queue List */}
        <div className="lg:col-span-5 space-y-2">
          <div className="font-heading font-semibold text-xs text-muted uppercase tracking-wider px-1">
            Pending Actions ({approvals.length})
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted bg-surface rounded-card border border-line">
              Loading pending queue...
            </div>
          ) : approvals.length === 0 ? (
            <div className="p-8 text-center text-muted bg-surface rounded-card border border-line space-y-2">
              <CheckCircle2 className="w-8 h-8 text-selfcare mx-auto" />
              <p className="font-medium text-ink text-sm">All Dual-Control Queues Cleared</p>
              <p className="text-xs text-muted">No administrative actions currently awaiting second-party sign-off.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {approvals.map((a) => {
                const isSelected = selectedApproval?.id === a.id;
                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedApproval(a)}
                    className={`p-3.5 rounded-card border cursor-pointer transition-all space-y-2 ${
                      isSelected
                        ? "border-primary bg-primary-soft/10 shadow-xs"
                        : "border-line bg-surface hover:border-primary/40 hover:bg-bg/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-ink">
                        #{a.id} — {a.action_code}
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-urgent/15 text-urgent font-bold">
                        PENDING
                      </span>
                    </div>

                    <p className="text-xs text-muted line-clamp-2">
                      {a.reason || "Administrative operation"}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-line/60">
                      <span>Target: <strong className="font-mono text-ink">{a.target_type} #{a.target_id}</strong></span>
                      <span className="font-mono">{new Date(a.requested_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Pane: Selected Action Diff & Decision */}
        <div className="lg:col-span-7 space-y-4">
          {selectedApproval ? (
            <div className="rounded-card border border-line bg-surface p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-line">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary-soft text-primary font-bold">
                      #{selectedApproval.id}
                    </span>
                    <h3 className="font-heading font-bold text-base text-ink">
                      {selectedApproval.action_code}
                    </h3>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Target: <strong className="text-ink font-mono">{selectedApproval.target_type} #{selectedApproval.target_id}</strong>
                  </p>
                </div>

                <div className="text-right text-xs">
                  <div className="text-muted">Requester:</div>
                  <div className="font-mono font-semibold text-ink">
                    User #{selectedApproval.requester_id}
                  </div>
                </div>
              </div>

              {/* Justification Box */}
              <div className="p-3.5 rounded-lg border border-line bg-bg space-y-1 text-xs">
                <span className="font-semibold text-ink text-[11px] block">Requester Justification:</span>
                <p className="text-muted leading-relaxed">{selectedApproval.reason}</p>
              </div>

              {/* DiffViewer Component */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-ink block">State Change Preview (Diff):</span>
                <DiffViewer
                  title="Proposed State Transformation"
                  oldVersionLabel="Before State (Current Production)"
                  newVersionLabel="Proposed State (Pending Authorization)"
                  oldContent={
                    selectedApproval.before_state
                      ? JSON.stringify(selectedApproval.before_state, null, 2)
                      : "/* Target record in active production state */\n{\n  \"status\": \"active\",\n  \"purged\": false\n}"
                  }
                  newContent={
                    selectedApproval.proposed_state
                      ? JSON.stringify(selectedApproval.proposed_state, null, 2)
                      : "/* Target record after dual-control execution */\n{\n  \"status\": \"purged\",\n  \"purged\": true,\n  \"redacted\": true\n}"
                  }
                />
              </div>

              {/* Self-Approval Warning if strict mode */}
              {isRequesterSelf && (
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p>
                    <strong>Dual-Control Safeguard Notice:</strong> You are the requester of this action (User #{currentAdmin?.id}). In strict production mode, you cannot approve your own action. In demo mode, self-approval will be marked with a <code className="font-mono">self_approved_demo</code> audit tag.
                  </p>
                </div>
              )}

              {/* Review Notes Input */}
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Approver Review Notes & Observations:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional review notes, authorization ticket ref, or rejection justification..."
                  className="w-full text-xs rounded-lg border border-line bg-bg p-2.5 text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Decision Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => handleDecision("REJECT")}
                  className="px-4 py-2 rounded-lg bg-emergency/10 border border-emergency/20 text-emergency font-semibold text-xs hover:bg-emergency/20 flex items-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Action</span>
                </button>

                <button
                  type="button"
                  disabled={deciding}
                  onClick={() => handleDecision("APPROVE")}
                  className="px-5 py-2 rounded-lg bg-selfcare text-white font-semibold text-xs hover:bg-selfcare/90 flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Authorize & Execute</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-muted bg-surface rounded-card border border-line">
              Select an action from the pending queue to inspect state diff and authorize.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

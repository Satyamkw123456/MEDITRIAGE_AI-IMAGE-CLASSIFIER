"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { 
  ShieldCheck, 
  Clock, 
  Trash2, 
  Edit3, 
  UserCheck, 
  XCircle, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  FileText,
  Filter,
  Eye,
  X
} from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { ConfirmTypeToProceed } from "@/components/shared/ConfirmTypeToProceed";

export interface DPDPRequest {
  id: number;
  user_id: number;
  request_type: "erasure" | "correction" | "access" | "nomination";
  status: "pending" | "verified" | "completed" | "rejected";
  created_at: string;
  due_date: string;
  is_overdue: boolean;
  hours_remaining: number;
  identity_verified: boolean;
  payload?: any;
}

export function DataRightsQueue({ overdueOnly = false }: { overdueOnly?: boolean }) {
  const [requests, setRequests] = useState<DPDPRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isOverdueFilter, setIsOverdueFilter] = useState(overdueOnly);
  const [statusFilter, setStatusFilter] = useState("");

  // Action Dialogs
  const [activeRequest, setActiveRequest] = useState<DPDPRequest | null>(null);
  const [actionType, setActionType] = useState<"verify" | "erasure" | "correction" | "reject" | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [confirmErasureOpen, setConfirmErasureOpen] = useState(false);
  const [correctionJson, setCorrectionJson] = useState("{}");
  const [collectedReason, setCollectedReason] = useState("");

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetailView = async (reqId: number) => {
    setDetailLoading(true);
    setDetailModalOpen(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/dpdp/requests/{request_id}", "get", {
        pathParams: { request_id: reqId },
      });
      setDetailRequest(data);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load request detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/dpdp/requests", "get", {
        params: {
          overdue_only: isOverdueFilter ? true : undefined,
          status_filter: statusFilter || undefined,
        },
      });
      setRequests(data.requests || []);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, [isOverdueFilter, statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const triggerAction = (r: DPDPRequest, type: "verify" | "erasure" | "correction" | "reject") => {
    setActiveRequest(r);
    setActionType(type);
    if (type === "correction" && r.payload) {
      setCorrectionJson(JSON.stringify(r.payload.corrections || { name: "Updated Name" }, null, 2));
    }
    setReasonDialogOpen(true);
  };

  const handleReasonConfirmed = ({ reason }: { category: string; reason: string }) => {
    setCollectedReason(reason);
    setReasonDialogOpen(false);
    if (actionType === "erasure") {
      setConfirmErasureOpen(true);
    } else {
      executeAction(reason);
    }
  };

  const executeAction = async (reasonToUse?: string) => {
    if (!activeRequest || !actionType) return;
    const reason = reasonToUse || collectedReason;
    const reqId = activeRequest.id;

    try {
      if (actionType === "verify") {
        await apiClient.fetch("/api/v1/admin/dpdp/requests/{request_id}/verify", "post", {
          pathParams: { request_id: reqId },
          body: { reason },
        });
      } else if (actionType === "erasure") {
        await apiClient.fetch("/api/v1/admin/dpdp/requests/{request_id}/erasure", "post", {
          pathParams: { request_id: reqId },
          body: { reason },
        });
      } else if (actionType === "correction") {
        let parsed = {};
        try {
          parsed = JSON.parse(correctionJson);
        } catch {
          parsed = { correction_notes: correctionJson };
        }
        await apiClient.fetch("/api/v1/admin/dpdp/requests/{request_id}/correction", "post", {
          pathParams: { request_id: reqId },
          body: {
            reason,
            corrections: parsed,
          },
        });
      } else if (actionType === "reject") {
        await apiClient.fetch("/api/v1/admin/dpdp/requests/{request_id}/reject", "post", {
          pathParams: { request_id: reqId },
          body: { reason },
        });
      }

      setSuccessMsg(`DPDP Request #${reqId} '${actionType}' successfully processed.`);
      loadRequests();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Operation failed.");
    } finally {
      setActiveRequest(null);
      setActionType(null);
      setConfirmErasureOpen(false);
      setDetailModalOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-soft text-primary font-mono text-xs font-semibold mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Digital Personal Data Protection Act 2023 (DPDP)
          </div>
          <h3 className="font-heading font-bold text-base text-ink">
            Statutory Data Rights Request Queue
          </h3>
          <p className="text-xs text-muted">
            Enforces 30-day statutory SLA timers for patient rights of erasure, correction, and nominated data fiduciaries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer px-2.5 py-1 rounded-lg border border-line bg-bg">
            <input
              type="checkbox"
              checked={isOverdueFilter}
              onChange={(e) => setIsOverdueFilter(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-line text-emergency focus:ring-emergency"
            />
            <span className="font-medium text-emergency">Overdue SLA Only</span>
          </label>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1 rounded-lg border border-line bg-bg text-ink"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            type="button"
            onClick={loadRequests}
            className="p-1.5 rounded-lg border border-line bg-bg hover:bg-surface text-muted hover:text-ink"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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

      {/* Requests Table */}
      <div className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/70 border-b border-line text-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Request ID</th>
                <th className="p-3">User Ref</th>
                <th className="p-3">Right Type</th>
                <th className="p-3">Identity Verified</th>
                <th className="p-3">Status</th>
                <th className="p-3">Statutory SLA Timer</th>
                <th className="p-3 text-right">Fulfillment Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">Loading DPDP queue...</td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">No data rights requests in queue.</td>
                </tr>
              ) : (
                requests.map((r) => {
                  const daysLeft = Math.floor(r.hours_remaining / 24);

                  return (
                    <tr key={r.id} className="hover:bg-bg/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-ink">
                        <button
                          type="button"
                          onClick={() => openDetailView(r.id)}
                          className="hover:underline text-primary"
                          title="View Request Details"
                        >
                          #{r.id}
                        </button>
                      </td>
                      <td className="p-3 font-mono text-muted">
                        User #{r.user_id}
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-xs px-2 py-0.5 rounded uppercase font-semibold bg-bg border border-line text-ink">
                          {r.request_type}
                        </span>
                      </td>
                      <td className="p-3">
                        {r.identity_verified ? (
                          <span className="inline-flex items-center gap-1 text-selfcare font-semibold text-[11px]">
                            <UserCheck className="w-3.5 h-3.5" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-urgent font-semibold text-[11px]">
                            <Clock className="w-3.5 h-3.5" /> Unverified
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            r.status === "completed"
                              ? "bg-selfcare/15 text-selfcare"
                              : r.status === "rejected"
                              ? "bg-muted/15 text-muted"
                              : "bg-urgent/15 text-urgent"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {r.is_overdue ? (
                          <span className="inline-flex items-center gap-1 text-emergency font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" /> OVERDUE ({Math.abs(daysLeft)}d overdue)
                          </span>
                        ) : (
                          <span className="text-ink font-semibold">
                            {daysLeft} days remaining ({new Date(r.due_date).toLocaleDateString()})
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDetailView(r.id)}
                            className="px-2 py-1 rounded border border-line bg-bg text-ink hover:bg-surface text-[11px] font-medium flex items-center gap-1"
                            title="View Full Detail"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Details</span>
                          </button>

                          {!r.identity_verified && r.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => triggerAction(r, "verify")}
                              className="px-2 py-1 rounded bg-primary text-surface font-semibold text-[11px] hover:bg-primary-dark shadow-xs"
                            >
                              Verify
                            </button>
                          )}

                          {r.request_type === "erasure" && r.status !== "completed" && (
                            <button
                              type="button"
                              onClick={() => triggerAction(r, "erasure")}
                              className="px-2 py-1 rounded bg-emergency/10 border border-emergency/20 text-emergency font-semibold text-[11px] hover:bg-emergency/20"
                            >
                              Erasure
                            </button>
                          )}

                          {r.request_type === "correction" && r.status !== "completed" && (
                            <button
                              type="button"
                              onClick={() => triggerAction(r, "correction")}
                              className="px-2 py-1 rounded bg-selfcare/10 border border-selfcare/20 text-selfcare font-semibold text-[11px] hover:bg-selfcare/20"
                            >
                              Correction
                            </button>
                          )}

                          {r.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => triggerAction(r, "reject")}
                              className="px-2 py-1 rounded border border-line bg-bg text-muted hover:text-ink text-[11px]"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface border border-line rounded-card max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-bold text-base text-ink">
                  DPDP Request #{detailRequest?.id || "..."}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setDetailModalOpen(false); setDetailRequest(null); }}
                className="p-1 rounded-lg border border-line hover:bg-bg text-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="p-8 text-center text-xs text-muted">
                Loading request metadata from /admin/dpdp/requests...
              </div>
            ) : detailRequest ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-bg rounded-lg border border-line">
                  <div>
                    <span className="text-muted block text-[11px]">User Reference</span>
                    <span className="font-mono font-bold text-ink">User #{detailRequest.user_id}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Request Type</span>
                    <span className="font-mono font-bold uppercase text-ink">{detailRequest.request_type}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Status</span>
                    <span className="font-mono font-semibold uppercase">{detailRequest.status}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Identity Verified</span>
                    <span className={detailRequest.identity_verified ? "text-selfcare font-semibold" : "text-urgent font-semibold"}>
                      {detailRequest.identity_verified ? "Yes (Verified)" : "No (Pending)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Created At</span>
                    <span className="font-mono text-muted">{new Date(detailRequest.created_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Due Date (SLA)</span>
                    <span className="font-mono font-semibold text-ink">{new Date(detailRequest.due_date).toLocaleDateString()}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-heading font-semibold text-xs text-ink mb-1">Payload & Corrections</h4>
                  <pre className="p-3 bg-bg rounded-lg border border-line font-mono text-[11px] overflow-x-auto max-h-48 text-ink">
                    {JSON.stringify(detailRequest.payload || {}, null, 2)}
                  </pre>
                </div>

                <div className="pt-2 border-t border-line flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {!detailRequest.identity_verified && detailRequest.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => triggerAction(detailRequest, "verify")}
                        className="px-2.5 py-1.5 rounded bg-primary text-surface font-semibold hover:bg-primary-dark text-xs"
                      >
                        Verify Identity
                      </button>
                    )}
                    {detailRequest.request_type === "erasure" && detailRequest.status !== "completed" && (
                      <button
                        type="button"
                        onClick={() => triggerAction(detailRequest, "erasure")}
                        className="px-2.5 py-1.5 rounded bg-emergency/10 border border-emergency/20 text-emergency font-semibold hover:bg-emergency/20 text-xs"
                      >
                        Execute Erasure
                      </button>
                    )}
                    {detailRequest.request_type === "correction" && detailRequest.status !== "completed" && (
                      <button
                        type="button"
                        onClick={() => triggerAction(detailRequest, "correction")}
                        className="px-2.5 py-1.5 rounded bg-selfcare/10 border border-selfcare/20 text-selfcare font-semibold hover:bg-selfcare/20 text-xs"
                      >
                        Apply Correction
                      </button>
                    )}
                    {detailRequest.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => triggerAction(detailRequest, "reject")}
                        className="px-2.5 py-1.5 rounded border border-line bg-bg text-muted hover:text-ink text-xs"
                      >
                        Reject
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => { setDetailModalOpen(false); setDetailRequest(null); }}
                    className="px-3 py-1.5 rounded border border-line bg-bg hover:bg-surface text-ink text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-emergency">Failed to load request details.</div>
            )}
          </div>
        </div>
      )}

      {/* Reason Dialog */}
      <ReasonDialog
        isOpen={reasonDialogOpen}
        title={`DPDP Action: ${actionType?.toUpperCase()} on Request #${activeRequest?.id}`}
        actionDescription={`Processing ${activeRequest?.request_type} right for User #${activeRequest?.user_id} under DPDP Act 2023 statutory mandate.`}
        categories={[
          "Patient Identity Confirmed via Official ID Document",
          "Statutory Right Exercised Under DPDP Section 12",
          "Identity Verification Failed / Fraud Suspected",
          "Legal Defense / Statutory Retention Obligation",
        ]}
        minReasonLength={5}
        onConfirm={handleReasonConfirmed}
        onCancel={() => setReasonDialogOpen(false)}
      />

      {/* Confirm Type-To-Proceed for Erasure */}
      <ConfirmTypeToProceed
        isOpen={confirmErasureOpen}
        title={`Irrevocable DPDP Erasure: User #${activeRequest?.user_id}`}
        warningMessage={`You are executing a STATUTORY RIGHT TO ERASURE. This permanently cryptographically redacts all clinical notes, intake records, and identifies for User #${activeRequest?.user_id}. If an active legal hold exists, this action will be unconditionally aborted.`}
        expectedWord="ERASE DATA"
        confirmButtonText="Execute Irrevocable Erasure"
        onConfirm={() => executeAction()}
        onCancel={() => setConfirmErasureOpen(false)}
      />
    </div>
  );
}

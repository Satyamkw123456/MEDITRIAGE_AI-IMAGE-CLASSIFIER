"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";
import { Users, Link2Off, RefreshCw, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";

export interface CaregiverLinkItem {
  id: number;
  patient_id: number;
  caregiver_id: number;
  payload?: any;
  created_at: string | null;
}

export function CaregiverLinksPanel() {
  const [links, setLinks] = useState<CaregiverLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Revoke state
  const [selectedLink, setSelectedLink] = useState<CaregiverLinkItem | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/users/caregiver-links", "get");
      setLinks(data.links || []);
    } catch (err: any) {
      setError(err.message || "Failed to load caregiver links.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const handleRevokeClick = (link: CaregiverLinkItem) => {
    setSelectedLink(link);
    setReasonDialogOpen(true);
  };

  const handleReasonConfirmed = async ({ reason }: { category: string; reason: string }) => {
    if (!selectedLink) return;
    setReasonDialogOpen(false);
    const linkId = selectedLink.id;

    try {
      await apiClient.fetch("/api/v1/admin/users/caregiver-links/{link_id}", "delete", {
        pathParams: { link_id: linkId },
        body: { reason },
      });
      setSuccessMsg(`Caregiver link #${linkId} successfully revoked.`);
      loadLinks();
    } catch (err: any) {
      setError(err.message || "Operation failed.");
    } finally {
      setSelectedLink(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-soft text-primary font-mono text-xs font-semibold mb-1">
            <Users className="w-3.5 h-3.5" />
            Caregiver Oversight & Delegation
          </div>
          <h3 className="font-heading font-bold text-base text-ink">
            Active Caregiver Link Governance
          </h3>
          <p className="text-xs text-muted">
            Monitors patient-caregiver delegated representation relationships. Revocations immediately invalidate delegated token scopes.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLinks}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-bg hover:bg-surface text-xs font-medium text-ink transition-colors shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
          <span>Refresh Links</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-lg border border-emergency/30 bg-emergency/5 text-xs text-emergency flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </span>
          <button type="button" onClick={() => setError(null)} className="underline font-semibold">
            Dismiss
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-lg border border-selfcare/30 bg-selfcare/5 text-xs text-selfcare flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="underline font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {/* Caregiver Links Table */}
      <div className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/70 border-b border-line text-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Link ID</th>
                <th className="p-3">Patient Ref</th>
                <th className="p-3">Caregiver Ref</th>
                <th className="p-3">Relationship / Payload</th>
                <th className="p-3">Established Date</th>
                <th className="p-3 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted">
                    Loading caregiver oversight links...
                  </td>
                </tr>
              ) : links.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted">
                    No active caregiver delegation links found.
                  </td>
                </tr>
              ) : (
                links.map((link) => (
                  <tr key={link.id} className="hover:bg-bg/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-ink">
                      #{link.id}
                    </td>
                    <td className="p-3 font-mono text-ink">
                      Patient #{link.patient_id}
                    </td>
                    <td className="p-3 font-mono text-ink">
                      Caregiver #{link.caregiver_id}
                    </td>
                    <td className="p-3">
                      {link.payload ? (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-bg border border-line">
                          {typeof link.payload === "string" ? link.payload : JSON.stringify(link.payload)}
                        </span>
                      ) : (
                        <span className="text-muted text-[11px]">Standard Representation</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-muted text-[11px]">
                      {link.created_at ? new Date(link.created_at).toLocaleString() : "Unknown"}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRevokeClick(link)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emergency/10 border border-emergency/20 text-emergency hover:bg-emergency/20 text-[11px] font-semibold transition-colors"
                        title="Revoke Caregiver Link"
                      >
                        <Link2Off className="w-3.5 h-3.5" />
                        <span>Revoke Link</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reason Dialog for Revocation */}
      <ReasonDialog
        isOpen={reasonDialogOpen}
        title={`Revoke Caregiver Delegation Link #${selectedLink?.id}`}
        actionDescription={`Revoking delegation link between Patient #${selectedLink?.patient_id} and Caregiver #${selectedLink?.caregiver_id}. All active sessions using this scope will be revoked.`}
        categories={[
          "Patient Revoked Caregiver Authority",
          "Legal Guardian Status Expired",
          "Clinical Governance Safety Order",
          "Fraudulent Representation Investigation",
        ]}
        minReasonLength={5}
        onConfirm={handleReasonConfirmed}
        onCancel={() => {
          setReasonDialogOpen(false);
          setSelectedLink(null);
        }}
      />
    </div>
  );
}

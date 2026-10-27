"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { 
  FileText, 
  Search, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Plus, 
  ShieldCheck,
  Clock
} from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";

export interface ConsentLedgerEntry {
  id: number;
  user_id: number;
  consent_type: string;
  version: string;
  granted: boolean;
  granted_by: string;
  ip_address?: string;
  created_at: string;
}

export function ConsentLedgerViewer() {
  const [logs, setLogs] = useState<ConsentLedgerEntry[]>([]);
  const [userIdFilter, setUserIdFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Bump Version Modal
  const [bumpModalOpen, setBumpModalOpen] = useState(false);
  const [newVersion, setNewVersion] = useState("v2.0");
  const [bumpReason, setBumpReason] = useState("");
  const [saving, setSaving] = useState(false);

  const loadConsentLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/dpdp/consent-ledger", "get", {
        params: {
          user_id: userIdFilter.trim() ? parseInt(userIdFilter.trim(), 10) : undefined,
          limit: 50,
        },
      });
      setLogs(data.ledger || []);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load consent ledger.");
    } finally {
      setLoading(false);
    }
  }, [userIdFilter]);

  useEffect(() => {
    loadConsentLedger();
  }, [loadConsentLedger]);

  const handleBumpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.fetch("/api/v1/admin/dpdp/consent-version-bump", "post", {
        body: {
          new_version: newVersion.trim(),
          reason: bumpReason.trim(),
        },
      });

      setSuccessMsg(`Consent policy bumped to '${newVersion}'. All active patients flagged for re-consent.`);
      setBumpModalOpen(false);
      setBumpReason("");
      loadConsentLedger();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to bump consent version.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-soft text-primary font-mono text-xs font-semibold mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            DPDP Section 6 Digital Consent Ledger
          </div>
          <h3 className="font-heading font-bold text-base text-ink">
            Immutable Patient Consent History
          </h3>
          <p className="text-xs text-muted">
            Traceable digital consent logs tracking purpose, version, timestamps, and caregiver authority.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter by User ID..."
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-line bg-bg font-mono text-ink"
            />
          </div>

          <button
            type="button"
            onClick={() => setBumpModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-surface text-xs font-semibold hover:bg-primary-dark transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Bump Policy Version</span>
          </button>
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

      {/* Consent Ledger Table */}
      <div className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/70 border-b border-line text-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Record ID</th>
                <th className="p-3">User Ref</th>
                <th className="p-3">Consent Purpose</th>
                <th className="p-3">Policy Version</th>
                <th className="p-3">Status</th>
                <th className="p-3">Granted By</th>
                <th className="p-3">IP Address</th>
                <th className="p-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted">Loading consent logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted">No consent records found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-bg/40 transition-colors">
                    <td className="p-3 font-mono font-semibold text-ink">#{log.id}</td>
                    <td className="p-3 font-mono text-muted">User #{log.user_id}</td>
                    <td className="p-3 font-mono text-ink text-xs">{log.consent_type}</td>
                    <td className="p-3">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-bg border border-line font-bold">
                        {log.version}
                      </span>
                    </td>
                    <td className="p-3">
                      {log.granted ? (
                        <span className="inline-flex items-center gap-1 text-selfcare font-semibold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emergency font-semibold text-xs">
                          <XCircle className="w-3.5 h-3.5" /> Revoked
                        </span>
                      )}
                    </td>
                    <td className="p-3 capitalize text-muted">{log.granted_by}</td>
                    <td className="p-3 font-mono text-muted text-[11px]">{log.ip_address || "Internal UI"}</td>
                    <td className="p-3 text-right font-mono text-muted text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Bump Policy Version */}
      {bumpModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-popover space-y-4">
            <h3 className="font-heading font-semibold text-base text-ink">
              Publish New Statutory Consent Version
            </h3>
            <form onSubmit={handleBumpSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-ink font-medium mb-1">New Policy Version String:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. v2.1-dpdp-compliance"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-ink"
                />
              </div>

              <div>
                <label className="block text-ink font-medium mb-1">Justification / Legal Advisory Reference:</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Statutory reason for updating terms and requiring re-consent..."
                  value={bumpReason}
                  onChange={(e) => setBumpReason(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
                />
              </div>

              <div className="p-3 rounded-lg border border-urgent/20 bg-urgent/5 text-[11px] text-ink/90">
                <strong>Statutory Impact:</strong> Bumping this version flags all existing active patients with <code className="font-mono">requires_reconsent=true</code>. Patients will be prompted to re-accept terms on next login.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setBumpModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-line bg-bg text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary-dark"
                >
                  {saving ? "Publishing..." : "Publish & Require Re-Consent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

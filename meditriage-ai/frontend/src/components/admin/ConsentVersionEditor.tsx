"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock,
  History,
  ArrowUpCircle
} from "lucide-react";

interface ConsentData {
  version: string;
  title: string;
  text: string;
  effective_date: string;
}

export function ConsentVersionEditor() {
  const [consent, setConsent] = useState<ConsentData>({
    version: "1.0.0",
    title: "Digital Personal Data Protection (DPDP) Patient Consent",
    text: "By proceeding, you consent to the processing of your clinical health data under the Digital Personal Data Protection Act, 2023.",
    effective_date: "2026-09-01T00:00:00Z",
  });

  const [bumpModalOpen, setBumpModalOpen] = useState(false);
  const [newVersion, setNewVersion] = useState("1.1.0");
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [bumpReason, setBumpReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [bumping, setBumping] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchConsent();
  }, []);

  const fetchConsent = async () => {
    setLoading(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/content/consent", "get");
      setConsent(data);
      setNewTitle(data.title || "");
      setNewText(data.text || "");
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleBumpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersion.trim() || !newText.trim() || !bumpReason.trim()) {
      setNotification({ type: "error", message: "Version, text, and reason are strictly mandatory." });
      return;
    }

    setBumping(true);
    setNotification(null);
    try {
      await apiClient.fetch("/api/v1/admin/content/consent/bump", "post", {
        body: {
          new_version: newVersion.trim(),
          title: newTitle.trim(),
          text: newText.trim(),
          reason: bumpReason.trim(),
        },
      });

      setBumpModalOpen(false);
      setNotification({
        type: "success",
        message: `Consent version bumped to v${newVersion}! Re-consent requirement immediately triggered across active patient accounts.`,
      });
      fetchConsent();
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to bump consent version." });
    } finally {
      setBumping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-soft text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Statutory DPDP Consent & Disclaimer Versioning</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-bg border border-line text-muted">
                Active Version: v{consent.version}
              </span>
            </h2>
            <p className="text-xs text-muted">
              Manages statutory digital consent agreements and medical AI disclaimers with automated re-consent triggers.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setBumpModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-primary text-surface font-semibold text-xs hover:bg-primary/95 shadow-button flex items-center gap-1.5"
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
          <span>Bump Consent Version</span>
        </button>
      </div>

      {notification && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
            notification.type === "success"
              ? "bg-selfcare/10 border-selfcare/30 text-selfcare"
              : "bg-emergency/10 border-emergency/30 text-emergency"
          }`}
        >
          <span>{notification.message}</span>
          <button type="button" onClick={() => setNotification(null)} className="text-muted hover:text-ink">
            Dismiss
          </button>
        </div>
      )}

      {/* Active Consent Card */}
      <div className="rounded-xl border border-line bg-surface p-6 shadow-card space-y-4 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h3 className="font-heading font-bold text-base text-ink">{consent.title}</h3>
            <span className="text-muted font-mono text-[11px]">Effective Date: {consent.effective_date}</span>
          </div>
          <span className="px-2.5 py-1 rounded-full font-mono text-xs font-bold bg-selfcare/15 text-selfcare">
            ACTIVE PUBLISHED
          </span>
        </div>

        <div>
          <span className="font-semibold text-muted block mb-1">Statutory Consent Terms (Rendered to Patients):</span>
          <div className="p-4 rounded-xl border border-line bg-bg/50 leading-relaxed text-ink font-sans text-xs whitespace-pre-wrap">
            {consent.text}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-line bg-bg/40 flex items-start gap-2.5 text-muted text-[11px]">
          <ShieldAlert className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Immutable Consent Ledger Integration:</strong> Every time a patient agrees to these terms, an entry with their timestamp, SHA-256 payload hash, and IP address is permanently logged to the DPDP Consent Ledger.
          </p>
        </div>
      </div>

      {/* Bump Version Modal with Warning */}
      {bumpModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-popover space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-urgent" />
              <h3 className="font-heading font-bold text-base text-ink">Bump Statutory Consent Version</h3>
            </div>

            {/* Prominent Re-consent Warning */}
            <div className="p-3.5 rounded-xl border border-urgent/40 bg-urgent/10 text-urgent space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>MANDATORY RE-CONSENT IMPACT WARNING</span>
              </span>
              <p className="text-[11px] leading-relaxed text-ink/90">
                Publishing a new consent version will <strong>immediately flag all existing active patients and caregivers</strong> with <code className="font-mono text-urgent font-bold">requires_reconsent = True</code>.
                Users will be blocked at login until they review and accept these updated terms.
              </p>
            </div>

            <form onSubmit={handleBumpSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">New Version Identifier:</label>
                  <input
                    type="text"
                    value={newVersion}
                    onChange={(e) => setNewVersion(e.target.value)}
                    placeholder="e.g. 1.1.0"
                    required
                    className="w-full p-2.5 rounded-lg border border-line bg-bg font-mono text-ink"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Document Title:</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="DPDP Patient Consent"
                    required
                    className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Updated Consent Text:</label>
                <textarea
                  rows={4}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">
                  Mandatory Legal / Clinical Justification:
                </label>
                <textarea
                  rows={2}
                  value={bumpReason}
                  onChange={(e) => setBumpReason(e.target.value)}
                  placeholder="Explain legal amendment triggering this re-consent..."
                  required
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setBumpModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-line text-muted hover:text-ink font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bumping}
                  className="px-5 py-2 rounded-lg bg-urgent text-surface font-semibold hover:bg-urgent/90 shadow-button disabled:opacity-50"
                >
                  {bumping ? "Publishing & Flagging Users..." : "Confirm & Trigger Re-Consent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

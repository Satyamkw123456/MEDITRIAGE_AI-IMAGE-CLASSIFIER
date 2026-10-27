"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Eye,
  Clock,
  CheckCircle2,
  FileText,
  Search,
  Lock,
  Unlock
} from "lucide-react";

interface BreakGlassEvent {
  id: number;
  case_id: number;
  user_id: number;
  user_email?: string;
  reason: string;
  started_at: string;
  expires_at: string;
  is_active: boolean;
}

interface RevealResponse {
  case_id: number;
  chief_complaint: string;
  emergency_rule_fired?: string | null;
  patient_id: number;
  expires_at: string;
  is_active: boolean;
  ttl_minutes: number;
}

export function BreakGlassModal() {
  const [caseId, setCaseId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<number>(10);

  const [activeReveal, setActiveReveal] = useState<RevealResponse | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  const [history, setHistory] = useState<BreakGlassEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (!activeReveal) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(activeReveal.expires_at).getTime() - Date.now()) / 1000));
      setSecondsRemaining(diff);
      if (diff === 0) {
        setActiveReveal(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeReveal]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/support/break-glass/list", "get");
      setHistory(data.reveals || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleRevealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId || !reason.trim() || reason.trim().length < 10) {
      setNotification({
        type: "error",
        message: "Case ID and a detailed clinical justification (minimum 10 characters) are strictly mandatory.",
      });
      return;
    }

    setSubmitting(true);
    setNotification(null);

    try {
      const data: any = await apiClient.fetch("/api/v1/admin/support/cases/{case_id}/break-glass", "post", {
        pathParams: { case_id: parseInt(caseId, 10) },
        body: {
          reason: reason.trim(),
          duration_minutes: durationMinutes,
        },
      });

      setActiveReveal(data);
      const initialSeconds = Math.max(0, Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000));
      setSecondsRemaining(initialSeconds);
      setNotification({
        type: "success",
        message: `Emergency break-glass reveal granted for Case #${data.case_id}. TTL countdown is active.`,
      });
      fetchHistory();
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Break-glass authorization rejected." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emergency/15 text-emergency">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Emergency Break-Glass PHI Reveal Protocol</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-bg border border-line text-muted">
                Statutory TTL: &le; 10 min
              </span>
            </h2>
            <p className="text-xs text-muted">
              Emergency department resuscitation override. Decrypts case PHI with mandatory justification, visible TTL countdown, and cryptographic auditor transparency.
            </p>
          </div>
        </div>
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

      {/* Active Reveal Banner with Visible Countdown */}
      {activeReveal && (
        <div
          id="break-glass-active-display"
          className="p-5 rounded-xl border border-emergency/40 bg-emergency/10 space-y-4 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emergency font-bold text-sm">
              <Unlock className="w-5 h-5 animate-pulse" />
              <span>EMERGENCY PHI REVEAL ACTIVE — CASE #{activeReveal.case_id}</span>
            </div>

            {secondsRemaining !== null && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-emergency/30 text-emergency font-mono font-bold text-xs shadow-xs">
                <Clock className="w-4 h-4" />
                <span>
                  TTL REMAINING: {Math.floor(secondsRemaining / 60)}:
                  {secondsRemaining % 60 < 10 ? `0${secondsRemaining % 60}` : secondsRemaining % 60}
                </span>
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-surface border border-line space-y-2">
            <span className="font-mono text-[10px] uppercase text-muted block">Unmasked Chief Complaint</span>
            <div className="font-semibold text-sm text-ink">{activeReveal.chief_complaint}</div>
            {activeReveal.emergency_rule_fired && (
              <div className="text-[11px] font-mono text-emergency">
                Triggered Rule: {activeReveal.emergency_rule_fired}
              </div>
            )}
          </div>

          <div className="text-[11px] text-muted flex items-center justify-between">
            <span>Patient Profile ID: #{activeReveal.patient_id}</span>
            <span>Expires at: {activeReveal.expires_at}</span>
          </div>
        </div>
      )}

      {/* Request Form */}
      <div className="rounded-xl border border-line bg-surface p-6 shadow-card space-y-4 text-xs">
        <h3 className="font-heading font-bold text-sm text-ink pb-3 border-b border-line flex items-center gap-2">
          <Eye className="w-4 h-4 text-emergency" />
          <span>Execute Emergency Break-Glass Request</span>
        </h3>

        <form onSubmit={handleRevealSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-ink mb-1">Target Case ID (Database ID):</label>
              <input
                type="number"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                placeholder="e.g. 14"
                required
                className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">Authorization Duration (TTL &le; 10 min):</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={3}>3 Minutes (Urgent Resuscitation View)</option>
                <option value={5}>5 Minutes (Clinical Triage Review)</option>
                <option value={10}>10 Minutes (Maximum Statutory TTL)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-ink mb-1">
              Detailed Clinical Justification (min 10 characters, permanently logged):
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Emergency department resuscitation; unconscious patient presenting with acute hypotension..."
              required
              className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-emergency text-surface font-semibold hover:bg-emergency/90 shadow-button disabled:opacity-50 flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>{submitting ? "Authorizing Override..." : "Execute Break-Glass Reveal"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Auditor-Visible Break-Glass History Table */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h3 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span>Auditor-Visible Break-Glass Reveal Trail ({history.length})</span>
            </h3>
            <span className="text-muted text-[11px]">
              Every emergency reveal is logged immutably with practitioner email and timestamp.
            </span>
          </div>

          <button
            type="button"
            onClick={fetchHistory}
            className="px-3 py-1 rounded-lg border border-line text-muted hover:text-ink"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-bg text-muted border-b border-line font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Event ID</th>
                <th className="py-2.5 px-4">Case ID</th>
                <th className="py-2.5 px-4">User ID / Email</th>
                <th className="py-2.5 px-4">Justification</th>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No emergency break-glass reveal events recorded.
                  </td>
                </tr>
              ) : (
                history.map((evt) => (
                  <tr key={evt.id} className="hover:bg-bg/40">
                    <td className="py-2.5 px-4 font-mono font-bold text-ink">#{evt.id}</td>
                    <td className="py-2.5 px-4 font-mono text-primary font-medium">Case #{evt.case_id}</td>
                    <td className="py-2.5 px-4 font-mono">{evt.user_email || `User #${evt.user_id}`}</td>
                    <td className="py-2.5 px-4 text-ink max-w-xs truncate">{evt.reason}</td>
                    <td className="py-2.5 px-4 font-mono text-muted text-[11px]">{evt.started_at}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          evt.is_active ? "bg-emergency/15 text-emergency" : "bg-bg text-muted"
                        }`}
                      >
                        {evt.is_active ? "ACTIVE" : "EXPIRED"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

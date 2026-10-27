"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState } from "react";
import {
  UserCheck,
  ShieldAlert,
  AlertTriangle,
  Play,
  StopCircle,
  Clock,
  Ticket,
  Search,
  CheckCircle2,
  Lock
} from "lucide-react";

interface ImpersonationResult {
  session_id: number;
  target_user_id: number;
  target_role: string;
  token: string;
  expires_at: string;
  ttl_minutes: number;
  is_read_only: boolean;
  impersonated_by: number;
}

export function ImpersonationLauncher() {
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [ticketRef, setTicketRef] = useState<string>("TICK-8842");
  const [reason, setReason] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<number>(15);

  const [activeSession, setActiveSession] = useState<ImpersonationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleStartImpersonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId || !ticketRef.trim() || !reason.trim()) {
      setNotification({ type: "error", message: "User ID, Ticket Reference, and Reason are all strictly mandatory." });
      return;
    }

    setLoading(true);
    setNotification(null);

    try {
      const data: any = await apiClient.fetch("/api/v1/admin/support/impersonate", "post", {
        body: {
          target_user_id: parseInt(targetUserId, 10),
          reason: reason.trim(),
          ticket_ref: ticketRef.trim(),
          duration_minutes: durationMinutes,
        },
      });

      setActiveSession(data);
      // Store impersonation token in localStorage so PersistentImpersonationBanner and requests use it
      localStorage.setItem("impersonation_token", data.token);
      localStorage.setItem("impersonation_session_id", String(data.session_id));
      localStorage.setItem("impersonation_ticket_ref", ticketRef.trim());
      localStorage.setItem("impersonation_expires_at", data.expires_at);

      setNotification({
        type: "success",
        message: `Impersonation session started for User #${data.target_user_id} (${data.target_role})! Hard READ-ONLY mode is strictly enforced.`,
      });
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.data?.detail || err.message || "Failed to start impersonation session.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStopImpersonation = async () => {
    if (!activeSession) return;
    setStopping(true);
    try {
      await apiClient.fetch("/api/v1/admin/support/impersonate/{session_id}/stop", "post", {
        pathParams: { session_id: activeSession.session_id },
      });
      localStorage.removeItem("impersonation_token");
      localStorage.removeItem("impersonation_session_id");
      localStorage.removeItem("impersonation_ticket_ref");
      localStorage.removeItem("impersonation_expires_at");
      setActiveSession(null);
      setNotification({ type: "success", message: "Impersonation session terminated. Normal admin authority restored." });
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to terminate session." });
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-soft text-primary">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Support Impersonation Launcher (&quot;View As&quot;)</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-bg border border-line text-muted">
                Max TTL: 15 min
              </span>
            </h2>
            <p className="text-xs text-muted">
              Inspect user journeys and triage accounts under statutory support authorization. Enforces strict read-only mode — all writes are blocked.
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

      {/* Active Session Warning Card if Running */}
      {activeSession && (
        <div className="p-5 rounded-xl border border-urgent/40 bg-urgent/10 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-urgent font-bold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>ACTIVE IMPERSONATION SESSION #{activeSession.session_id}</span>
            </div>
            <button
              type="button"
              onClick={handleStopImpersonation}
              disabled={stopping}
              className="px-3 py-1.5 rounded-lg bg-emergency text-surface font-semibold hover:bg-emergency/90 shadow-button"
            >
              {stopping ? "Ending..." : "End Session Now"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono pt-2 border-t border-urgent/20 text-ink">
            <div>
              <span className="text-[10px] text-muted block">Target User ID</span>
              <span className="font-bold">#{activeSession.target_user_id}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted block">Target Role</span>
              <span className="font-bold uppercase text-primary">{activeSession.target_role}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted block">Expires At</span>
              <span className="font-bold">{activeSession.expires_at}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted block">Read-Only Guard</span>
              <span className="font-bold text-selfcare">ENFORCED (403 on write)</span>
            </div>
          </div>
        </div>
      )}

      {/* Launcher Form */}
      <div className="rounded-xl border border-line bg-surface p-6 shadow-card space-y-5 text-xs">
        <h3 className="font-heading font-bold text-sm text-ink pb-3 border-b border-line flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <span>Launch Authorized View-As Session</span>
        </h3>

        <form onSubmit={handleStartImpersonation} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-ink mb-1">Target User ID (Database ID):</label>
              <input
                type="number"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="e.g. 55"
                required
                className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">Support Ticket Reference:</label>
              <input
                type="text"
                value={ticketRef}
                onChange={(e) => setTicketRef(e.target.value)}
                placeholder="e.g. TICK-8842"
                required
                className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">Session Duration (TTL &le; 15 min):</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={5}>5 Minutes (Quick Verification)</option>
                <option value={10}>10 Minutes (Standard Review)</option>
                <option value={15}>15 Minutes (Maximum Statutory TTL)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-ink mb-1">
              Mandatory Support Justification (Audit Logged):
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why accessing this account is clinically or technically necessary..."
              required
              className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="p-3.5 rounded-xl border border-line bg-bg/50 flex items-start gap-2.5 text-[11px] text-muted">
            <AlertTriangle className="w-4 h-4 text-urgent shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Statutory Compliance Notice:</strong> Under DPDP Act 2023, this session is permanently entered into the patient&apos;s access history transparency log and the cryptographic admin audit chain. You cannot impersonate administrative roles.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || Boolean(activeSession)}
              className="px-5 py-2.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary/95 shadow-button disabled:opacity-50 flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{loading ? "Generating Authorized Token..." : "Start Impersonation Session"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

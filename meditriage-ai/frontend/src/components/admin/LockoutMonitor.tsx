"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { Lock, Unlock, ShieldAlert, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";

export interface LockoutItem {
  user_id: number;
  email: string;
  role: string;
  failed_login_attempts: number;
  locked_until: string | null;
  is_suspended: boolean;
}

export function LockoutMonitor() {
  const [lockouts, setLockouts] = useState<LockoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<LockoutItem | null>(null);

  const loadLockouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/users/lockouts/list", "get");
      setLockouts(data.lockouts || []);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load account lockouts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLockouts();
  }, [loadLockouts]);

  const handleUnlockConfirmed = async ({ reason }: { category: string; reason: string }) => {
    if (!unlockTarget) return;
    const target = unlockTarget;
    setUnlockTarget(null);

    try {
      await apiClient.fetch("/api/v1/admin/users/{user_id}/unlock", "post", {
        pathParams: { user_id: target.user_id },
        body: { reason },
      });
      setSuccessMsg(`User #${target.user_id} (${target.email}) unlocked successfully.`);
      loadLockouts();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Unlock failed.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emergency/10 text-emergency font-mono text-xs font-semibold mb-1">
            <Lock className="w-3.5 h-3.5" />
            Brute-Force & Credential Stuffing Defense
          </div>
          <h3 className="font-heading font-bold text-base text-ink">
            Account Lockout & Failed Login Monitor
          </h3>
          <p className="text-xs text-muted">
            Users are automatically locked out after 5 consecutive failed login attempts to protect against brute-force attacks.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLockouts}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-bg hover:bg-surface text-xs font-medium text-ink transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
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

      <div className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/70 border-b border-line text-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">User ID</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Role</th>
                <th className="p-3">Failed Attempts</th>
                <th className="p-3">Locked Until</th>
                <th className="p-3">Suspension Status</th>
                <th className="p-3 text-right">Unlock Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted">
                    Scanning lockout states...
                  </td>
                </tr>
              ) : lockouts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted">
                    No active account lockouts. All user accounts have normal login status.
                  </td>
                </tr>
              ) : (
                lockouts.map((l) => (
                  <tr key={l.user_id} className="hover:bg-bg/40 transition-colors">
                    <td className="p-3 font-mono font-semibold text-ink">#{l.user_id}</td>
                    <td className="p-3 font-mono text-ink">{l.email}</td>
                    <td className="p-3">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-bg border border-line">
                        {l.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-mono font-bold text-emergency">
                        {l.failed_login_attempts} failures
                      </span>
                    </td>
                    <td className="p-3 font-mono text-muted text-[11px]">
                      {l.locked_until ? new Date(l.locked_until).toLocaleString() : "Permanent Lock"}
                    </td>
                    <td className="p-3">
                      {l.is_suspended ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emergency/10 text-emergency font-semibold">
                          Suspended
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-selfcare/10 text-selfcare font-semibold">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setUnlockTarget(l)}
                        className="px-3 py-1 rounded-lg bg-primary text-surface font-semibold hover:bg-primary-dark text-xs inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unlock Account</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReasonDialog
        isOpen={Boolean(unlockTarget)}
        title={`Unlock Account for User #${unlockTarget?.user_id}`}
        actionDescription={`Clearing failed login attempts for ${unlockTarget?.email}. User will be permitted to authenticate immediately.`}
        categories={[
          "User Verified via Out-of-Band Challenge (Phone / In-Person)",
          "False-Positive Lockout Triggered by Session Desync",
          "Clinician Shift Emergency Unlock",
        ]}
        minReasonLength={5}
        onConfirm={handleUnlockConfirmed}
        onCancel={() => setUnlockTarget(null)}
      />
    </div>
  );
}

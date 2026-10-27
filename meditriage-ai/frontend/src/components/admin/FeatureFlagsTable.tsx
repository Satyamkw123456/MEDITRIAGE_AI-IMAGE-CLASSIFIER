"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { 
  Sliders, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Users, 
  User, 
  Percent, 
  ToggleLeft, 
  ToggleRight,
  RefreshCw,
  Info
} from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";

export interface FeatureFlag {
  id?: number;
  name: string;
  flag_type: "boolean" | "percentage" | "per_role" | "per_user" | "scheduled";
  enabled: boolean;
  percentage?: number;
  allowed_roles?: string[];
  allowed_user_ids?: number[];
  effective_at?: string | null;
  environment?: string;
  version?: number;
  updated_at?: string;
}

export function FeatureFlagsTable() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [env, setEnv] = useState("production");

  // Edit / Toggle Action
  const [activeFlag, setActiveFlag] = useState<FeatureFlag | null>(null);
  const [pendingFlagPayload, setPendingFlagPayload] = useState<any>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);

  // New Flag Modal
  const [newFlagModalOpen, setNewFlagModalOpen] = useState(false);
  const [newFlagName, setNewFlagName] = useState("");
  const [newFlagType, setNewFlagType] = useState<"boolean" | "percentage" | "per_role" | "per_user" | "scheduled">("boolean");
  const [newFlagEnabled, setNewFlagEnabled] = useState(true);
  const [newFlagPercentage, setNewFlagPercentage] = useState(10);
  const [newFlagRoles, setNewFlagRoles] = useState("clinician,admin");
  const [newFlagUserIds, setNewFlagUserIds] = useState("");
  const [newFlagEffectiveAt, setNewFlagEffectiveAt] = useState("");
  const [newFlagReason, setNewFlagReason] = useState("");

  const loadFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/flags", "get", {
        params: { environment: env },
      });
      setFlags(data.flags || []);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load feature flags.");
    } finally {
      setLoading(false);
    }
  }, [env]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const triggerToggle = (flag: FeatureFlag) => {
    setActiveFlag(flag);
    const updated = {
      ...flag,
      flag_name: flag.name,
      enabled: !flag.enabled,
    };
    setPendingFlagPayload(updated);
    setReasonDialogOpen(true);
  };

  const triggerUpdate = (flag: FeatureFlag, updates: Partial<FeatureFlag>) => {
    setActiveFlag(flag);
    const updated = {
      ...flag,
      ...updates,
      flag_name: flag.name,
    };
    setPendingFlagPayload(updated);
    setReasonDialogOpen(true);
  };

  const handleReasonConfirmed = async ({ reason }: { category: string; reason: string }) => {
    setReasonDialogOpen(false);
    if (!pendingFlagPayload) return;

    try {
      await apiClient.fetch("/api/v1/admin/flags", "post", {
        body: {
          flag_name: pendingFlagPayload.flag_name || pendingFlagPayload.name,
          flag_type: pendingFlagPayload.flag_type,
          enabled: pendingFlagPayload.enabled,
          percentage: pendingFlagPayload.percentage,
          allowed_roles: pendingFlagPayload.allowed_roles,
          allowed_user_ids: pendingFlagPayload.allowed_user_ids,
          effective_at: pendingFlagPayload.effective_at,
          reason,
        },
      });

      setSuccessMsg(`Feature flag '${pendingFlagPayload.flag_name || pendingFlagPayload.name}' updated successfully.`);
      loadFlags();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to set feature flag.");
    } finally {
      setActiveFlag(null);
      setPendingFlagPayload(null);
    }
  };

  const handleCreateFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const allowedRoles = newFlagType === "per_role" ? newFlagRoles.split(",").map((s) => s.trim()) : undefined;
      const allowedUsers = newFlagType === "per_user" ? newFlagUserIds.split(",").map((s) => Number(s.trim())).filter(Boolean) : undefined;
      const effectiveAt = newFlagType === "scheduled" && newFlagEffectiveAt ? new Date(newFlagEffectiveAt).toISOString() : undefined;

      await apiClient.fetch("/api/v1/admin/flags", "post", {
        body: {
          flag_name: newFlagName.trim(),
          flag_type: newFlagType,
          enabled: newFlagEnabled,
          percentage: newFlagType === "percentage" ? newFlagPercentage : undefined,
          allowed_roles: allowedRoles,
          allowed_user_ids: allowedUsers,
          effective_at: effectiveAt,
          reason: newFlagReason.trim(),
        },
      });

      setNewFlagModalOpen(false);
      setNewFlagName("");
      setNewFlagReason("");
      setSuccessMsg(`Feature flag '${newFlagName}' created successfully.`);
      loadFlags();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to create feature flag.");
    }
  };

  return (
    <div className="space-y-4">
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

      {/* Top Header & Env Bar */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-ink">
              Feature Flag Governance
            </h3>
            <p className="text-xs text-muted">
              Dynamically toggle feature visibility, canary percentage rollouts, and role-gated capabilities.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-line bg-bg font-mono text-ink"
          >
            <option value="production">production</option>
            <option value="staging">staging</option>
            <option value="development">development</option>
          </select>

          <button
            type="button"
            onClick={() => setNewFlagModalOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-surface text-xs font-semibold hover:bg-primary-dark transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Feature Flag</span>
          </button>
        </div>
      </div>

      {/* Flags List Table */}
      <div className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/70 border-b border-line text-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Flag Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Targeting / Configuration</th>
                <th className="p-3">Version</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted">Loading flags...</td>
                </tr>
              ) : flags.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted">No feature flags configured for {env}.</td>
                </tr>
              ) : (
                flags.map((f) => (
                  <tr key={f.name} className="hover:bg-bg/40 transition-colors">
                    <td className="p-3 font-mono font-semibold text-ink">
                      {f.name}
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-bg border border-line uppercase">
                        {f.flag_type}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => triggerToggle(f)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          f.enabled
                            ? "bg-selfcare/15 text-selfcare border border-selfcare/30 hover:bg-selfcare/25"
                            : "bg-muted/15 text-muted border border-muted/30 hover:bg-muted/25"
                        }`}
                      >
                        {f.enabled ? <ToggleRight className="w-4 h-4 text-selfcare" /> : <ToggleLeft className="w-4 h-4 text-muted" />}
                        <span>{f.enabled ? "ENABLED" : "DISABLED"}</span>
                      </button>
                    </td>
                    <td className="p-3 text-xs">
                      {f.flag_type === "percentage" && (
                        <div className="flex items-center gap-2">
                          <Percent className="w-3.5 h-3.5 text-primary" />
                          <span className="font-mono font-bold text-ink">{f.percentage || 0}%</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={f.percentage || 0}
                            onChange={(e) => triggerUpdate(f, { percentage: Number(e.target.value) })}
                            className="w-24 h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>
                      )}
                      {f.flag_type === "per_role" && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Users className="w-3.5 h-3.5 text-muted" />
                          {(f.allowed_roles || []).map((r) => (
                            <span key={r} className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-primary-soft text-primary">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                      {f.flag_type === "per_user" && (
                        <div className="flex items-center gap-1 text-muted">
                          <User className="w-3.5 h-3.5" />
                          <span>{(f.allowed_user_ids || []).length} user(s) explicitly targeted</span>
                        </div>
                      )}
                      {f.flag_type === "scheduled" && (
                        <div className="flex items-center gap-1 text-muted">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{f.effective_at ? new Date(f.effective_at).toLocaleString() : "Immediately"}</span>
                        </div>
                      )}
                      {f.flag_type === "boolean" && (
                        <span className="text-muted text-[11px]">Global binary toggle</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-muted text-xs">
                      v{f.version || 1}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => triggerToggle(f)}
                        className="text-xs px-2.5 py-1 rounded-md border border-line bg-surface hover:bg-bg text-ink font-medium"
                      >
                        Toggle with Justification
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reason Dialog for Flag Changes */}
      <ReasonDialog
        isOpen={reasonDialogOpen}
        title={`Confirm Feature Flag Modification: '${activeFlag?.name}'`}
        actionDescription={`Modifying live feature flag '${activeFlag?.name}' targeting environment '${env}'.`}
        categories={[
          "Staged Gradual Rollout Expansion",
          "Canary Deployment Canary Failure / Reversal",
          "Operational Performance Load Shedding",
          "Clinical Safety Guardrail Adjustment",
        ]}
        minReasonLength={5}
        onConfirm={handleReasonConfirmed}
        onCancel={() => setReasonDialogOpen(false)}
      />

      {/* Modal: New Feature Flag */}
      {newFlagModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-popover space-y-4">
            <h3 className="font-heading font-semibold text-base text-ink">
              Create New Feature Flag
            </h3>
            <form onSubmit={handleCreateFlag} className="space-y-3 text-xs">
              <div>
                <label className="block text-ink font-medium mb-1">Flag Name / Identifier:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ai_hub_v2, differential_explain_v3"
                  value={newFlagName}
                  onChange={(e) => setNewFlagName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-ink"
                />
              </div>

              <div>
                <label className="block text-ink font-medium mb-1">Targeting Type:</label>
                <select
                  value={newFlagType}
                  onChange={(e: any) => setNewFlagType(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
                >
                  <option value="boolean">Boolean (Global Toggle)</option>
                  <option value="percentage">Percentage Rollout (0-100%)</option>
                  <option value="per_role">Per-Role Multi-Tenant Gate</option>
                  <option value="per_user">Per-User Allowlist</option>
                  <option value="scheduled">Scheduled Activation</option>
                </select>
              </div>

              {newFlagType === "percentage" && (
                <div>
                  <label className="block text-ink font-medium mb-1">Rollout Percentage: {newFlagPercentage}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newFlagPercentage}
                    onChange={(e) => setNewFlagPercentage(Number(e.target.value))}
                    className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              )}

              {newFlagType === "per_role" && (
                <div>
                  <label className="block text-ink font-medium mb-1">Allowed Roles (comma-separated):</label>
                  <input
                    type="text"
                    value={newFlagRoles}
                    onChange={(e) => setNewFlagRoles(e.target.value)}
                    placeholder="clinician, admin"
                    className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink font-mono"
                  />
                </div>
              )}

              {newFlagType === "per_user" && (
                <div>
                  <label className="block text-ink font-medium mb-1">Allowed User IDs (comma-separated):</label>
                  <input
                    type="text"
                    value={newFlagUserIds}
                    onChange={(e) => setNewFlagUserIds(e.target.value)}
                    placeholder="1, 2, 5"
                    className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink font-mono"
                  />
                </div>
              )}

              {newFlagType === "scheduled" && (
                <div>
                  <label className="block text-ink font-medium mb-1">Effective Date / Time:</label>
                  <input
                    type="datetime-local"
                    value={newFlagEffectiveAt}
                    onChange={(e) => setNewFlagEffectiveAt(e.target.value)}
                    className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-ink font-medium mb-1">Mandatory Justification (Reason):</label>
                <textarea
                  required
                  rows={2}
                  value={newFlagReason}
                  onChange={(e) => setNewFlagReason(e.target.value)}
                  placeholder="Clinical or technical rationale..."
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setNewFlagModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-line bg-bg text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary-dark"
                >
                  Create Flag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

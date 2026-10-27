"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { 
  Settings, 
  RotateCcw, 
  Save, 
  History, 
  CheckCircle2, 
  RefreshCw, 
  Code2, 
  AlertCircle 
} from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";

export interface SettingItem {
  namespace: string;
  key: string;
  value: any;
  version: number;
  updated_at?: string;
  versions?: {
    version: number;
    created_at: string;
    checksum?: string;
    note?: string;
    author_id?: number;
  }[];
}

export function SettingsEditor() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<string>("all");

  // Edit / Rollback State
  const [activeSetting, setActiveSetting] = useState<SettingItem | null>(null);
  const [editValueText, setEditValueText] = useState("");
  const [rollbackTarget, setRollbackTarget] = useState<{ setting: SettingItem; version: number } | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"SAVE" | "ROLLBACK">("SAVE");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/settings", "get", {
        params: { namespace: selectedNamespace !== "all" ? selectedNamespace : undefined },
      });
      setSettings(data.settings || []);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load system settings.");
    } finally {
      setLoading(false);
    }
  }, [selectedNamespace]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleEditClick = (s: SettingItem) => {
    setActiveSetting(s);
    setEditValueText(
      typeof s.value === "object" ? JSON.stringify(s.value, null, 2) : String(s.value)
    );
  };

  const handleSaveClick = (s: SettingItem) => {
    setActiveSetting(s);
    setActionType("SAVE");
    setReasonDialogOpen(true);
  };

  const handleRollbackClick = (s: SettingItem, ver: number) => {
    setRollbackTarget({ setting: s, version: ver });
    setActionType("ROLLBACK");
    setReasonDialogOpen(true);
  };

  const handleReasonConfirmed = async ({ reason }: { category: string; reason: string }) => {
    setReasonDialogOpen(false);
    try {
      if (actionType === "SAVE" && activeSetting) {
        let parsedVal: any = editValueText;
        try {
          parsedVal = JSON.parse(editValueText);
        } catch {
          // keep as string
        }

        await apiClient.fetch("/api/v1/admin/settings", "post", {
          body: {
            namespace: activeSetting.namespace,
            key: activeSetting.key,
            value: parsedVal,
            reason,
          },
        });

        setSuccessMsg(`Setting '${activeSetting.namespace}:${activeSetting.key}' published.`);
      } else if (actionType === "ROLLBACK" && rollbackTarget) {
        await apiClient.fetch("/api/v1/admin/settings/rollback", "post", {
          body: {
            namespace: rollbackTarget.setting.namespace,
            key: rollbackTarget.setting.key,
            target_version: rollbackTarget.version,
            reason,
          },
        });

        setSuccessMsg(
          `Rolled back '${rollbackTarget.setting.namespace}:${rollbackTarget.setting.key}' to version ${rollbackTarget.version}.`
        );
      }
      loadSettings();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Operation failed.");
    } finally {
      setActiveSetting(null);
      setRollbackTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-ink">
              System Settings & Version Registry
            </h3>
            <p className="text-xs text-muted">
              Live configuration parameters with immutable version history and one-click cryptographic rollback.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadSettings}
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

      {/* Settings List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-muted bg-surface rounded-card border border-line">
            Loading system settings...
          </div>
        ) : settings.length === 0 ? (
          <div className="p-8 text-center text-muted bg-surface rounded-card border border-line">
            No system settings found.
          </div>
        ) : (
          settings.map((s) => {
            const isEditing = activeSetting?.namespace === s.namespace && activeSetting?.key === s.key;

            return (
              <div
                key={`${s.namespace}-${s.key}`}
                className="rounded-card border border-line bg-surface p-4 shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-line">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary-soft text-primary font-bold">
                      {s.namespace}
                    </span>
                    <span className="font-mono text-sm font-semibold text-ink">
                      {s.key}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted">Active: v{s.version}</span>
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => handleEditClick(s)}
                        className="px-2.5 py-1 rounded-md border border-line bg-bg hover:bg-surface text-xs font-medium text-ink"
                      >
                        Edit Value
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveSetting(null)}
                          className="px-2.5 py-1 rounded-md border border-line bg-bg text-xs text-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveClick(s)}
                          className="px-3 py-1 rounded-md bg-primary text-surface text-xs font-semibold hover:bg-primary-dark flex items-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Publish Version</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Value Display / Editor */}
                {isEditing ? (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-mono text-muted">JSON / Value Payload:</label>
                    <textarea
                      rows={4}
                      value={editValueText}
                      onChange={(e) => setEditValueText(e.target.value)}
                      className="w-full rounded-lg border border-line bg-bg p-3 font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-bg border border-line/60 overflow-x-auto">
                    <pre className="font-mono text-xs text-ink">
                      {typeof s.value === "object" ? JSON.stringify(s.value, null, 2) : String(s.value)}
                    </pre>
                  </div>
                )}

                {/* Version History & Rollback Bar */}
                {s.versions && s.versions.length > 0 && (
                  <div className="pt-2 border-t border-line/50 space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] text-muted font-medium">
                      <History className="w-3 h-3" />
                      <span>Version History & Quick Rollback:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {s.versions.map((v) => (
                        <div
                          key={v.version}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-line bg-bg text-xs"
                        >
                          <span className="font-mono font-semibold text-ink">v{v.version}</span>
                          <span className="text-[10px] text-muted">
                            ({new Date(v.created_at).toLocaleDateString()})
                          </span>
                          {v.version !== s.version && (
                            <button
                              type="button"
                              onClick={() => handleRollbackClick(s, v.version)}
                              className="text-[11px] text-primary hover:underline font-semibold ml-1 flex items-center gap-0.5"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Rollback</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <ReasonDialog
        isOpen={reasonDialogOpen}
        title={
          actionType === "SAVE"
            ? `Publish Configuration: ${activeSetting?.namespace}:${activeSetting?.key}`
            : `Rollback Setting to Version ${rollbackTarget?.version}`
        }
        actionDescription={
          actionType === "SAVE"
            ? "Publishing this configuration creates an immutable version snapshot in the governance ledger."
            : `Reverting '${rollbackTarget?.setting.namespace}:${rollbackTarget?.setting.key}' to version ${rollbackTarget?.version}.`
        }
        categories={[
          "Routine Governance Update",
          "Production Defect Mitigation / Rollback",
          "Clinical Protocol Parameter Re-calibration",
        ]}
        minReasonLength={5}
        onConfirm={handleReasonConfirmed}
        onCancel={() => setReasonDialogOpen(false)}
      />
    </div>
  );
}

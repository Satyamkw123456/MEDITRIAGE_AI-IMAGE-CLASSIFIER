"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { 
  FileLock, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  RefreshCw,
  Plus
} from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";

export function LegalHoldManager() {
  const [targetType, setTargetType] = useState<"request" | "case">("request");
  const [targetId, setTargetId] = useState("");
  const [holdEnabled, setHoldEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId.trim()) {
      setError("Please enter a valid target ID.");
      return;
    }
    setReasonDialogOpen(true);
  };

  const handleReasonConfirmed = async ({ reason }: { category: string; reason: string }) => {
    setSaving(true);
    setReasonDialogOpen(false);
    setError(null);
    try {
      await apiClient.fetch("/api/v1/admin/dpdp/legal-hold", "post", {
        body: {
          target_type: targetType,
          target_id: parseInt(targetId.trim(), 10),
          enabled: holdEnabled,
          reason,
        },
      });

      setSuccessMsg(
        `Legal Hold ${holdEnabled ? "IMPOSED" : "RELEASED"} for ${targetType} #${targetId}.`
      );
      setTargetId("");
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to toggle legal hold.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-line">
        <div className="w-9 h-9 rounded-lg bg-emergency/10 text-emergency flex items-center justify-center">
          <FileLock className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-heading font-bold text-base text-ink">
            Statutory Legal Hold Enforcer
          </h3>
          <p className="text-xs text-muted">
            Impose mandatory litigation preservation holds. When active, DPDP erasures and case purges are unconditionally blocked.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-emergency/30 bg-emergency/5 text-xs text-emergency">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-lg border border-selfcare/30 bg-selfcare/5 text-xs text-selfcare flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-ink font-medium mb-1">Target Entity Type:</label>
            <select
              value={targetType}
              onChange={(e: any) => setTargetType(e.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink"
            >
              <option value="request">DPDP Data Request</option>
              <option value="case">Case Intake</option>
            </select>
          </div>

          <div>
            <label className="block text-ink font-medium mb-1">Target Entity ID:</label>
            <input
              type="text"
              required
              placeholder="e.g. 1042"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-ink"
            />
          </div>

          <div>
            <label className="block text-ink font-medium mb-1">Hold Status:</label>
            <select
              value={holdEnabled ? "true" : "false"}
              onChange={(e) => setHoldEnabled(e.target.value === "true")}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink"
            >
              <option value="true">Active Legal Hold (Blocks Erasure)</option>
              <option value="false">Release Hold</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-muted flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-emergency" />
            Every hold modification requires an explicit judicial or legal justification.
          </p>

          <button
            type="submit"
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-all ${
              holdEnabled
                ? "bg-emergency text-surface hover:bg-emergency/90"
                : "bg-primary text-surface hover:bg-primary-dark"
            }`}
          >
            {holdEnabled ? "Impose Legal Hold" : "Release Legal Hold"}
          </button>
        </div>
      </form>

      <ReasonDialog
        isOpen={reasonDialogOpen}
        title={`${holdEnabled ? "Impose" : "Release"} Legal Hold: ${targetType} #${targetId}`}
        actionDescription={`Modifying statutory litigation hold on ${targetType} #${targetId}.`}
        categories={[
          "Subpoena / Judicial Order Received",
          "Pending Medical Negligence Investigation",
          "Litigation Hold Terminated by Court Order",
        ]}
        minReasonLength={5}
        onConfirm={handleReasonConfirmed}
        onCancel={() => setReasonDialogOpen(false)}
      />
    </div>
  );
}

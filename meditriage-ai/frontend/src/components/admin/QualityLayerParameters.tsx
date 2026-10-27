"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  GitPullRequest,
  CheckSquare,
  Square
} from "lucide-react";

interface QualityParams {
  completeness_weight: number;
  consistency_weight: number;
  rule_llm_agreement_weight: number;
  evidence_density_weight: number;
  confidence_bands?: {
    high_threshold: number;
    medium_threshold: number;
    low_threshold: number;
  };
  emergency_bypass_banding?: boolean;
  version?: string;
  last_reviewed_at?: string;
}

export function QualityLayerParameters() {
  const [params, setParams] = useState<QualityParams>({
    completeness_weight: 0.35,
    consistency_weight: 0.20,
    rule_llm_agreement_weight: 0.25,
    evidence_density_weight: 0.20,
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [dualControlApproved, setDualControlApproved] = useState(false);
  const [regressionPassed, setRegressionPassed] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchParams = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/clinical/quality-parameters", "get");
      setParams(data);
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to load clinical quality parameters." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParams();
  }, [fetchParams]);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setNotification(null);

    try {
      await apiClient.fetch("/api/v1/admin/clinical/quality-parameters/unlock", "post", {
        body: {
          payload: {
            completeness_weight: params.completeness_weight,
            consistency_weight: params.consistency_weight,
            rule_llm_agreement_weight: params.rule_llm_agreement_weight,
            evidence_density_weight: params.evidence_density_weight,
          },
          dual_control_approved: dualControlApproved,
          regression_passed: regressionPassed,
          reason: unlockReason.trim() || "Quality layer parameter recalibration",
        },
      });

      setNotification({
        type: "success",
        message: "Quality Layer parameters successfully unlocked and updated with dual-control governance approval!",
      });
      setIsUnlocked(true);
    } catch (err: any) {
      setNotification({
        type: "error",
        message: `UNLOCK REJECTED: ${err.data?.detail || err.message || "Both dual-control authorization and a passing regression suite are strictly mandatory."}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Check sum of weights equals 1.0
  const totalWeight =
    params.completeness_weight +
    params.consistency_weight +
    params.rule_llm_agreement_weight +
    params.evidence_density_weight;
  const isWeightSumValid = Math.abs(totalWeight - 1.0) < 0.001;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-soft text-primary">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Clinical Quality Layer Parameter Governance</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1 ${
                  isUnlocked ? "bg-selfcare/15 text-selfcare" : "bg-emergency/15 text-emergency"
                }`}
              >
                {isUnlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {isUnlocked ? "UNLOCKED (Dual-Control Authorized)" : "LOCKED (Safety Safeguard)"}
              </span>
            </h2>
            <p className="text-xs text-muted">
              Controls ensemble weighting for diagnostic confidence, evidence density, and clinical agreement. Recalibration requires both dual-control sign-off and a certified passing regression suite run.
            </p>
          </div>
        </div>
      </div>

      {notification && (
        <div
          role="alert"
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
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

      {/* Main Parameters Card */}
      <div className="rounded-xl border border-line bg-surface p-6 shadow-card space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h3 className="font-heading font-bold text-sm text-ink">Quality Layer Scoring Weights</h3>
            <span className="text-xs text-muted">
              Total Weight: <strong className={isWeightSumValid ? "text-selfcare" : "text-emergency"}>{(totalWeight * 100).toFixed(0)}%</strong> (Must equal 100%)
            </span>
          </div>
          <span className="text-xs font-mono text-muted">Version: {params.version || "1.0.0"}</span>
        </div>

        {/* Weights Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="p-4 rounded-xl border border-line bg-bg/40 space-y-2">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-ink">Completeness Weight</span>
              <span className="font-mono text-primary font-bold">{(params.completeness_weight * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={params.completeness_weight}
              disabled={!isUnlocked}
              onChange={(e) => setParams({ ...params, completeness_weight: parseFloat(e.target.value) })}
              className="w-full accent-primary disabled:opacity-50 cursor-pointer"
            />
            <p className="text-[11px] text-muted leading-relaxed">
              Weights vital sign completeness and geriatric screening probe coverage.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-line bg-bg/40 space-y-2">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-ink">Consistency Weight</span>
              <span className="font-mono text-primary font-bold">{(params.consistency_weight * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={params.consistency_weight}
              disabled={!isUnlocked}
              onChange={(e) => setParams({ ...params, consistency_weight: parseFloat(e.target.value) })}
              className="w-full accent-primary disabled:opacity-50 cursor-pointer"
            />
            <p className="text-[11px] text-muted leading-relaxed">
              Penalizes internal contradiction between chief complaint, duration, and vitals.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-line bg-bg/40 space-y-2">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-ink">Rule-LLM Agreement Weight</span>
              <span className="font-mono text-primary font-bold">{(params.rule_llm_agreement_weight * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={params.rule_llm_agreement_weight}
              disabled={!isUnlocked}
              onChange={(e) => setParams({ ...params, rule_llm_agreement_weight: parseFloat(e.target.value) })}
              className="w-full accent-primary disabled:opacity-50 cursor-pointer"
            />
            <p className="text-[11px] text-muted leading-relaxed">
              Measures consensus between deterministic geriatric rules and LLM reasoning.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-line bg-bg/40 space-y-2">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-ink">Evidence Density Weight</span>
              <span className="font-mono text-primary font-bold">{(params.evidence_density_weight * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={params.evidence_density_weight}
              disabled={!isUnlocked}
              onChange={(e) => setParams({ ...params, evidence_density_weight: parseFloat(e.target.value) })}
              className="w-full accent-primary disabled:opacity-50 cursor-pointer"
            />
            <p className="text-[11px] text-muted leading-relaxed">
              Rewards specific clinical biomarker data (e.g. ECG, glucose, O2 saturation).
            </p>
          </div>
        </div>

        {/* Locked Safeguard Banner & Dual-Control Unlock Flow */}
        <div className="pt-4 border-t border-line space-y-4">
          <div className="p-4 rounded-xl border border-urgent/30 bg-urgent/10 flex items-start gap-3 text-xs">
            <AlertTriangle className="w-5 h-5 text-urgent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-ink">Statutory Clinical Governance Rule:</span>
              <p className="text-muted leading-relaxed">
                Modifications to Quality Layer weights alter automated triage confidence banding across all geriatric encounters.
                Under Gate 8, unlocking requires <strong>BOTH</strong> verified dual-control sign-off <strong>AND</strong> an unregressed synthetic suite validation.
              </p>
            </div>
          </div>

          <form onSubmit={handleUnlockSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label
                className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  dualControlApproved ? "border-primary bg-primary-soft/40 text-ink" : "border-line bg-bg/30 text-muted"
                }`}
              >
                <input
                  type="checkbox"
                  checked={dualControlApproved}
                  onChange={(e) => setDualControlApproved(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center border ${
                    dualControlApproved ? "bg-primary border-primary text-surface" : "border-line bg-surface"
                  }`}
                >
                  {dualControlApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <span className="font-semibold block text-ink">Dual-Control Approved</span>
                  <span className="text-[11px] text-muted">Second medical director has reviewed tuning</span>
                </div>
              </label>

              <label
                className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  regressionPassed ? "border-primary bg-primary-soft/40 text-ink" : "border-line bg-bg/30 text-muted"
                }`}
              >
                <input
                  type="checkbox"
                  checked={regressionPassed}
                  onChange={(e) => setRegressionPassed(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center border ${
                    regressionPassed ? "bg-primary border-primary text-surface" : "border-line bg-surface"
                  }`}
                >
                  {regressionPassed && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <span className="font-semibold block text-ink">Regression Suite Passed</span>
                  <span className="text-[11px] text-muted">60-case synthetic suite maintains 100% sensitivity</span>
                </div>
              </label>
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">
                Mandatory Clinical Recalibration Reason:
              </label>
              <textarea
                rows={2}
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="Explain justification for adjusting quality weights..."
                required
                className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary/95 shadow-button disabled:opacity-50 flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{submitting ? "Verifying Prerequisites..." : "Execute Dual-Control Unlock & Save"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

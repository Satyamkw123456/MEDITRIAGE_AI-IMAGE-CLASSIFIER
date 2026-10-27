"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  Power,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Save,
  Server,
  Activity
} from "lucide-react";

interface FeatureModelConfig {
  provider: string;
  model: string;
  enabled: boolean;
}

export function AIModelsAllowlist() {
  const [featureModels, setFeatureModels] = useState<Record<string, FeatureModelConfig>>({
    differential_diagnosis: { provider: "gemini", model: "gemini-flash-lite-latest", enabled: true },
    triage_explanation: { provider: "gemini", model: "gemini-flash-lite-latest", enabled: true },
    copilot_chat: { provider: "gemini", model: "gemini-flash-lite-latest", enabled: true },
    companion_chat: { provider: "gemini", model: "gemini-flash-lite-latest", enabled: true },
    clinician_digest: { provider: "gemini", model: "gemini-flash-lite-latest", enabled: true },
  });

  const [aiDataMode, setAiDataMode] = useState<string>("SYNTHETIC_ONLY");
  const [globalKillSwitchActive, setGlobalKillSwitchActive] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchAIConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/ai/models", "get");
      setFeatureModels(data);
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to load AI model configurations." });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAIStatus = useCallback(async () => {
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/ai/status", "get");
      setAiDataMode(data.ai_data_mode || "SYNTHETIC_ONLY");
      setGlobalKillSwitchActive(Boolean(data.global_kill_switch_active));
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    fetchAIConfig();
    fetchAIStatus();
  }, [fetchAIConfig, fetchAIStatus]);

  const handleModelChange = (feature: string, field: keyof FeatureModelConfig, value: any) => {
    setFeatureModels((prev) => ({
      ...prev,
      [feature]: {
        ...prev[feature],
        [field]: value,
      },
    }));
  };

  const handleSaveModels = async () => {
    setSaving(true);
    setNotification(null);
    try {
      await apiClient.fetch("/api/v1/admin/ai/models", "post", {
        body: {
          payload: featureModels,
          reason: "Updated feature-level AI provider & model allowlists",
        },
      });
      setNotification({ type: "success", message: "AI provider and model configurations updated successfully." });
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to update configurations." });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGlobalKillSwitch = async () => {
    const newState = !globalKillSwitchActive;
    setLoading(true);
    try {
      await apiClient.fetch("/api/v1/admin/ai/kill-switch", "post", {
        body: {
          enabled: newState,
          reason: newState ? "Emergency AI kill switch tripped by admin" : "Restoring normal AI operations",
        },
      });
      setGlobalKillSwitchActive(newState);
      setNotification({
        type: newState ? "error" : "success",
        message: newState
          ? "GLOBAL AI KILL SWITCH ACTIVATED! All generative pipelines degraded to deterministic fallback."
          : "Global AI operations restored to standard inference mode.",
      });
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to toggle kill switch." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Status & Global Kill Switch */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* AI Data Mode Display */}
        <div className="p-4 rounded-xl border border-line bg-surface shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted">Statutory Data Policy</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary-soft text-primary font-bold">
              DPDP 2023
            </span>
          </div>
          <div className="font-heading font-bold text-lg text-ink flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span>AI_DATA_MODE: {aiDataMode}</span>
          </div>
          <p className="text-[11px] text-muted mt-1 leading-relaxed">
            Zero real patient PHI enters model context. Pre-inference scrubbers ensure synthetic tokenization.
          </p>
        </div>

        {/* Inference Health */}
        <div className="p-4 rounded-xl border border-line bg-surface shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted">Primary Model Pipeline</span>
            <span className="w-2.5 h-2.5 rounded-full bg-selfcare animate-pulse" />
          </div>
          <div className="font-heading font-bold text-lg text-ink flex items-center gap-2">
            <Server className="w-5 h-5 text-selfcare" />
            <span>Gemini Flash Lite</span>
          </div>
          <p className="text-[11px] text-muted mt-1 leading-relaxed">
            Sub-100ms p50 latency with deterministic fallback on timeout or error.
          </p>
        </div>

        {/* Emergency Kill Switch Card */}
        <div
          className={`p-4 rounded-xl border shadow-xs transition-all ${
            globalKillSwitchActive
              ? "bg-emergency/15 border-emergency/40 text-emergency"
              : "bg-surface border-line text-ink"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold">Global AI Circuit Breaker</span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                globalKillSwitchActive ? "bg-emergency text-surface" : "bg-bg text-muted"
              }`}
            >
              {globalKillSwitchActive ? "TRIPPED" : "ARMED"}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted">
              {globalKillSwitchActive ? "Degraded to deterministic rules" : "Inference running normally"}
            </span>
            <button
              type="button"
              onClick={handleToggleGlobalKillSwitch}
              disabled={loading}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                globalKillSwitchActive
                  ? "bg-selfcare text-surface hover:bg-selfcare/90 shadow-button"
                  : "bg-emergency text-surface hover:bg-emergency/90 shadow-button"
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{globalKillSwitchActive ? "Deactivate Kill Switch" : "TRIP KILL SWITCH"}</span>
            </button>
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

      {/* Feature Allowlist Table */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-line">
          <div>
            <h3 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <span>Feature-Specific Provider & Model Allowlists</span>
            </h3>
            <p className="text-xs text-muted">
              Route specific clinical and copilot capabilities to certified model providers with individual disable switches.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveModels}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-surface font-semibold text-xs hover:bg-primary/95 shadow-button flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving..." : "Save Allowlist Changes"}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg text-muted border-b border-line font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Feature Domain</th>
                <th className="py-2.5 px-4">Provider</th>
                <th className="py-2.5 px-4">Model Identifier</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Enable / Disable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {Object.entries(featureModels).map(([feature, cfg]) => (
                <tr key={feature} className="hover:bg-bg/40">
                  <td className="py-3 px-4 font-mono font-semibold text-ink">
                    {feature}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={cfg.provider}
                      onChange={(e) => handleModelChange(feature, "provider", e.target.value)}
                      className="p-1.5 rounded-lg border border-line bg-surface text-ink text-xs focus:outline-none"
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="fake_provider">FakeProvider (Deterministic Mock)</option>
                      <option value="openai">OpenAI (Opt-in)</option>
                      <option value="anthropic">Anthropic (Opt-in)</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="text"
                      value={cfg.model}
                      onChange={(e) => handleModelChange(feature, "model", e.target.value)}
                      className="p-1.5 rounded-lg border border-line bg-surface text-ink font-mono text-xs w-56 focus:outline-none"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${
                        cfg.enabled ? "bg-selfcare/15 text-selfcare" : "bg-emergency/15 text-emergency"
                      }`}
                    >
                      {cfg.enabled ? "ACTIVE" : "DISABLED"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleModelChange(feature, "enabled", !cfg.enabled)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        cfg.enabled
                          ? "border border-emergency/30 text-emergency hover:bg-emergency/10"
                          : "border border-selfcare/30 text-selfcare hover:bg-selfcare/10"
                      }`}
                    >
                      {cfg.enabled ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

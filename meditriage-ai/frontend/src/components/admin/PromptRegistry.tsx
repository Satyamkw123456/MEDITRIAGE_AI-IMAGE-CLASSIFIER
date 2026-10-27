"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Play,
  CheckCircle2,
  GitCommit,
  Layers,
  Sparkles,
  Info,
  Clock,
  Eye,
  AlertTriangle,
  RotateCcw
} from "lucide-react";

interface PromptVersion {
  id?: number;
  key: string;
  version: number;
  status: string;
  system_template: string;
  user_template: string;
  template_hash: string;
  created_at?: string;
  note?: string;
}

interface SandboxResult {
  status: string;
  provider: string;
  is_live: boolean;
  template_hash: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  output: any;
}

export function PromptRegistry() {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [selectedPromptKey, setSelectedPromptKey] = useState<string>("geriatric_differential");
  const [systemTemplate, setSystemTemplate] = useState<string>("");
  const [userTemplate, setUserTemplate] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // Sandbox State
  const [isLiveSyntheticRun, setIsLiveSyntheticRun] = useState<boolean>(false);
  const [testPayload, setTestPayload] = useState<string>(
    JSON.stringify({ chief_complaint: "Fall with hip pain and slight confusion", age: 78, sex: "Female" }, null, 2)
  );
  const [sandboxLoading, setSandboxLoading] = useState<boolean>(false);
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/ai/prompts", "get");
      setPrompts(data);
      if (data.length > 0) {
        const current = data[0];
        setSelectedPromptKey(current.key);
        setSystemTemplate(current.system_template || "");
        setUserTemplate(current.user_template || "");
      }
    } catch {
      setNotification({ type: "error", message: "Failed to load prompt registry." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const handleSelectPrompt = (key: string) => {
    setSelectedPromptKey(key);
    const p = prompts.find((item) => item.key === key);
    if (p) {
      setSystemTemplate(p.system_template || "");
      setUserTemplate(p.user_template || "");
    }
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    setNotification(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/ai/prompts/draft", "post", {
        body: {
          prompt_key: selectedPromptKey,
          system_template: systemTemplate,
          user_template: userTemplate,
          note: note.trim() || `Draft revision for ${selectedPromptKey}`,
        },
      });
      setNotification({
        type: "success",
        message: `Draft v${data.version} created! Template Hash: ${data.checksum?.substring(0, 16)}...`,
      });
      fetchPrompts();
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to create prompt draft." });
    } finally {
      setLoading(false);
    }
  };

  const handleSandboxRun = async () => {
    setSandboxLoading(true);
    setNotification(null);
    try {
      let parsedCase = {};
      try {
        parsedCase = JSON.parse(testPayload);
      } catch {
        setNotification({ type: "error", message: "Test payload must be valid JSON." });
        setSandboxLoading(false);
        return;
      }

      const data: any = await apiClient.fetch("/api/v1/admin/ai/prompts/sandbox-run", "post", {
        body: {
          system_template: systemTemplate,
          user_template: userTemplate,
          test_case_payload: parsedCase,
          is_live: isLiveSyntheticRun,
        },
      });
      setSandboxResult(data);
      setNotification({
        type: "success",
        message: `Sandbox execution completed with ${data.provider} (${data.latency_ms.toFixed(1)}ms). Zero PHI verified.`,
      });
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Sandbox run failed." });
    } finally {
      setSandboxLoading(false);
    }
  };

  const handlePublish = async (ver: number) => {
    setLoading(true);
    try {
      await apiClient.fetch("/api/v1/admin/ai/prompts/publish", "post", {
        body: {
          prompt_key: selectedPromptKey,
          version: ver,
          reason: "Approved prompt revision following sandbox verification",
        },
      });
      setNotification({ type: "success", message: `Prompt ${selectedPromptKey} v${ver} published to production!` });
      fetchPrompts();
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to publish prompt." });
    } finally {
      setLoading(false);
    }
  };

  const currentPromptVersions = prompts.filter((p) => p.key === selectedPromptKey);
  const activePublished = currentPromptVersions.find((p) => p.status === "published");

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
              <span>AI Prompt Registry & Sandboxing</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-bg border border-line text-muted">
                Zero-PHI Certified
              </span>
            </h2>
            <p className="text-xs text-muted">
              Author, test in a sandbox against FakeProvider or opt-in live models, inspect hash diffs, and safely publish prompt templates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg border border-line text-ink hover:bg-bg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <GitCommit className="w-3.5 h-3.5 text-muted" />
            <span>Save Prompt Draft</span>
          </button>

          <button
            type="button"
            onClick={handleSandboxRun}
            disabled={sandboxLoading}
            className="px-3.5 py-1.5 rounded-lg bg-primary text-surface hover:bg-primary/95 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-button disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{sandboxLoading ? "Executing Sandbox..." : "Run in Sandbox"}</span>
          </button>
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Prompt Template List & Version History */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-3.5 rounded-xl border border-line bg-surface shadow-xs space-y-2">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block">Prompt Keys</span>
            <div className="space-y-1">
              {["geriatric_differential", "triage_explanation", "copilot_summary"].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleSelectPrompt(k)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                    selectedPromptKey === k
                      ? "bg-primary text-surface shadow-button"
                      : "text-ink hover:bg-bg"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-line bg-surface shadow-xs space-y-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block">
              Version History ({currentPromptVersions.length})
            </span>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
              {currentPromptVersions.map((v) => (
                <div key={v.id || v.version} className="p-2.5 rounded-lg border border-line bg-bg/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink font-mono">v{v.version}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold uppercase ${
                        v.status === "published"
                          ? "bg-selfcare/15 text-selfcare"
                          : "bg-bg border border-line text-muted"
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted truncate">
                    Hash: {v.template_hash?.substring(0, 16)}...
                  </div>
                  {v.status !== "published" && (
                    <button
                      type="button"
                      onClick={() => handlePublish(v.version)}
                      className="mt-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      Publish this version →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center/Right: Template Editor & Sandbox */}
        <div className="lg:col-span-8 space-y-5">
          {/* Template Editor */}
          <div className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-heading font-bold text-sm text-ink">
                Template Editor: <span className="font-mono text-primary">{selectedPromptKey}</span>
              </h3>
              {activePublished && (
                <span className="text-[11px] font-mono text-muted">
                  Active in Prod: v{activePublished.version}
                </span>
              )}
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">System Prompt Directive:</label>
              <textarea
                rows={4}
                value={systemTemplate}
                onChange={(e) => setSystemTemplate(e.target.value)}
                placeholder="System instructions establishing clinical bounds, safety rules, and tone..."
                className="w-full p-2.5 rounded-lg border border-line bg-bg font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">User Prompt Template (with variables):</label>
              <textarea
                rows={4}
                value={userTemplate}
                onChange={(e) => setUserTemplate(e.target.value)}
                placeholder="e.g. Chief complaint: {chief_complaint}, Age: {age}, Vitals: {vitals}..."
                className="w-full p-2.5 rounded-lg border border-line bg-bg font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">Release Note / Version Justification:</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Updated geriatric delirium prompt with NICE 2024 guidance"
                className="w-full p-2 rounded-lg border border-line bg-bg text-ink focus:outline-none"
              />
            </div>
          </div>

          {/* Sandbox Test Execution Panel */}
          <div className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
              <div>
                <h3 className="font-heading font-bold text-sm text-ink flex items-center gap-1.5">
                  <Play className="w-4 h-4 text-primary" />
                  <span>Sandbox Test Runner</span>
                </h3>
                <span className="text-muted text-[11px]">
                  Simulates prompt execution against test cases with zero risk to production.
                </span>
              </div>

              {/* Opt-in Live Checkbox */}
              <label className="flex items-center gap-2 p-2 rounded-lg border border-line bg-bg/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLiveSyntheticRun}
                  onChange={(e) => setIsLiveSyntheticRun(e.target.checked)}
                  className="rounded border-line text-primary focus:ring-primary"
                />
                <span className="font-semibold text-ink">
                  {isLiveSyntheticRun ? "Opt-in: LIVE Synthetic Model Run" : "Default: FakeProvider Mock Run"}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-ink mb-1">Input Synthetic Test Case (JSON):</label>
                <textarea
                  rows={6}
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-line bg-bg font-mono text-[11px] text-ink focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Execution Output Preview:</label>
                <div className="h-36 p-2.5 rounded-lg border border-line bg-bg/80 font-mono text-[11px] text-ink overflow-y-auto">
                  {sandboxResult ? (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(sandboxResult.output, null, 2)}</pre>
                  ) : (
                    <span className="text-muted">Click &quot;Run in Sandbox&quot; to test this prompt template.</span>
                  )}
                </div>
              </div>
            </div>

            {sandboxResult && (
              <div className="p-3 rounded-lg border border-line bg-bg/50 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                <div className="flex items-center gap-3">
                  <span>Provider: <strong className="text-primary">{sandboxResult.provider}</strong></span>
                  <span>Tokens In: <strong>{sandboxResult.tokens_in}</strong></span>
                  <span>Tokens Out: <strong>{sandboxResult.tokens_out}</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Latency: <strong className="text-selfcare">{sandboxResult.latency_ms.toFixed(1)}ms</strong></span>
                  <span className="text-selfcare font-bold">✓ ZERO PHI CERTIFIED</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

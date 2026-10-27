"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import {
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Upload,
  Download,
  Search,
  Eye,
  ShieldAlert,
  GitCommit,
  Layers,
  ChevronRight,
  Info,
  Clock
} from "lucide-react";

interface Rule {
  id: string;
  name: string;
  applies_if: string;
  escalate_to: string;
  escalate_to_emergency_if?: string | null;
  forbid_levels: string[];
  followups?: string[];
  refs?: string;
  validation_status?: string;
}

interface RegressionCase {
  case_id: string;
  case_name: string;
  reason: string;
}

interface CaseDelta {
  case_id: string;
  category_name: string;
  base_level: string;
  draft_level: string;
  base_band: string;
  draft_band: string;
  delta: "ESCALATED" | "DE-ESCALATED" | "UNCHANGED";
}

interface ImpactPreviewResult {
  total_cases: number;
  complete_twin_sensitivity: number;
  degraded_twin_sensitivity: number;
  regressions_count: number;
  regressions: RegressionCase[];
  deltas: CaseDelta[];
  suite_status: "PASSED" | "FAILED" | "NO_CASES_FOUND";
}

export function ClinicalRulesEditor() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [publishedRules, setPublishedRules] = useState<Rule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"editor" | "diff" | "preview" | "io">("editor");

  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [impactResult, setImpactResult] = useState<ImpactPreviewResult | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Publish & Rollback Modal States
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [reviewerName, setReviewerName] = useState("");
  const [publishReason, setPublishReason] = useState("");
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [targetRollbackVersion, setTargetRollbackVersion] = useState<number>(1);
  const [rollbackReason, setRollbackReason] = useState("");
  const [lastChecksum, setLastChecksum] = useState<string>("");

  // Import/Export state
  const [importContent, setImportContent] = useState("");
  const [importFormat, setImportFormat] = useState<"yaml" | "json" | "csv">("json");

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/clinical/rules", "get");
      const ruleList = Array.isArray(data) ? data : (data.rules || []);
      setRules(ruleList);
      setPublishedRules(ruleList);
      if (ruleList.length > 0 && !selectedRuleId) {
        setSelectedRuleId(ruleList[0].id);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to connect to clinical governance backend." });
    } finally {
      setLoading(false);
    }
  }, [selectedRuleId]);

  // Load rules on mount
  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleRuleChange = (field: keyof Rule, value: any) => {
    if (!selectedRuleId) return;
    setRules((prev) =>
      prev.map((r) => (r.id === selectedRuleId ? { ...r, [field]: value } : r))
    );
  };

  const handleCreateDraft = async () => {
    setLoading(true);
    setNotification(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/clinical/rules/draft", "post", {
        body: {
          namespace: "geriatric_rules",
          key: "rules",
          payload: rules as any,
          note: `Rule draft v${currentVersion + 1} updated via Clinical Rules Editor`,
        },
      });
      setCurrentVersion(data.version);
      setLastChecksum(data.checksum || "");
      setNotification({
        type: "success",
        message: `Draft v${data.version} created! SHA-256 Checksum: ${data.checksum?.substring(0, 16)}...`,
      });
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to create rule draft." });
    } finally {
      setLoading(false);
    }
  };

  const handleRunImpactPreview = async () => {
    setPreviewLoading(true);
    setNotification(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/clinical/rules/impact-preview", "post", {
        body: { payload: rules },
      });
      setImpactResult(data);
      setActiveTab("preview");
      if (data.suite_status === "FAILED") {
        setNotification({
          type: "error",
          message: `REGRESSION DETECTED: Red-flag sensitivity dropped to ${(data.complete_twin_sensitivity * 100).toFixed(1)}%. ${data.regressions_count} cases under-triaged!`,
        });
      } else {
        setNotification({
          type: "success",
          message: `Clinical Suite Passed: 100% red-flag sensitivity maintained across ${data.total_cases} cases!`,
        });
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Impact preview calculation failed." });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewerName.trim() || !publishReason.trim()) {
      setNotification({ type: "error", message: "Both Clinical Reviewer and Justification are strictly required." });
      return;
    }

    setLoading(true);
    setNotification(null);
    try {
      await apiClient.fetch("/api/v1/admin/clinical/rules/publish", "post", {
        body: {
          namespace: "geriatric_rules",
          key: "rules",
          version: currentVersion,
          validated_by: reviewerName.trim(),
          reason: publishReason.trim(),
        },
      });
      setPublishModalOpen(false);
      setPublishedRules([...rules]);
      setNotification({
        type: "success",
        message: `Rule version ${currentVersion} successfully PUBLISHED to active runtime by ${reviewerName}!`,
      });
    } catch (err: any) {
      setNotification({
        type: "error",
        message: `PUBLISH BLOCKED: ${err.data?.detail || err.message || "Clinical governance regression gate blocked this release."}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRollbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollbackReason.trim()) {
      setNotification({ type: "error", message: "Mandatory justification is required for rollback." });
      return;
    }

    setLoading(true);
    setNotification(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/clinical/rules/rollback", "post", {
        body: {
          namespace: "geriatric_rules",
          key: "rules",
          target_version: targetRollbackVersion,
          reason: rollbackReason.trim(),
        },
      });
      setRollbackModalOpen(false);
      setLastChecksum(data.checksum || "");
      setCurrentVersion(data.version);
      setNotification({
        type: "success",
        message: `Rollback complete! Created Version ${data.version} restoring Version ${targetRollbackVersion}. Checksum verified identical: ${data.checksum?.substring(0, 16)}...`,
      });
      fetchRules();
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Rollback failed." });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importContent.trim()) return;
    setLoading(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/clinical/rules/import", "post", {
        body: { content: importContent, format: importFormat },
      });
      if (data.rules) {
        setRules(data.rules);
        setNotification({ type: "success", message: `Successfully imported ${data.total_rules} rules (${importFormat.toUpperCase()}).` });
        setActiveTab("editor");
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to parse imported rules." });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: "json" | "yaml" | "csv") => {
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/clinical/rules/export", "post", {
        body: { rules, format_type: format },
      });
      const blob = new Blob([data.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `geriatric_rules_${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Export failed." });
    }
  };

  const selectedRule = rules.find((r) => r.id === selectedRuleId);
  const filteredRules = rules.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-soft text-primary">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Deterministic Geriatric Rules Engine</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-bg border border-line text-muted">
                v{currentVersion}
              </span>
            </h2>
            <p className="text-xs text-muted">
              Structured clinical protocol editor, YAML/CSV sync, version rollback, and real 60-case synthetic suite preview.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCreateDraft}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg border border-line text-ink hover:bg-bg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <GitCommit className="w-3.5 h-3.5 text-muted" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={handleRunImpactPreview}
            disabled={previewLoading}
            className="px-3.5 py-1.5 rounded-lg bg-selfcare/15 border border-selfcare/30 text-selfcare hover:bg-selfcare/25 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{previewLoading ? "Running 60-Case Suite..." : "Run Impact Preview"}</span>
          </button>

          <button
            type="button"
            onClick={() => setPublishModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-primary text-surface hover:bg-primary/95 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-button"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Publish Rule Set</span>
          </button>

          <button
            type="button"
            onClick={() => setRollbackModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg border border-line text-muted hover:text-ink text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Rollback</span>
          </button>
        </div>
      </div>

      {/* Notifications Banner */}
      {notification && (
        <div
          role="alert"
          className={`p-4 rounded-xl border text-xs font-medium flex items-start gap-2.5 transition-all ${
            notification.type === "success"
              ? "bg-selfcare/10 border-selfcare/30 text-selfcare"
              : notification.type === "error"
              ? "bg-emergency/10 border-emergency/30 text-emergency"
              : "bg-primary-soft border-primary/20 text-primary"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : notification.type === "error" ? (
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 leading-relaxed">{notification.message}</div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-muted hover:text-ink text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-line gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("editor")}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "editor"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Rules Editor ({rules.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "preview"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>60-Case Impact Preview</span>
          {impactResult && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                impactResult.suite_status === "PASSED"
                  ? "bg-selfcare/20 text-selfcare"
                  : "bg-emergency/20 text-emergency"
              }`}
            >
              {impactResult.suite_status}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("diff")}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "diff"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <GitCommit className="w-3.5 h-3.5" />
          <span>Version Diff Viewer</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("io")}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "io"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import / Export (YAML/CSV)</span>
        </button>
      </div>

      {/* TAB 1: RULES EDITOR */}
      {activeTab === "editor" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Rule Selector Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rule ID or guideline title..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-line bg-surface text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="max-h-[550px] overflow-y-auto space-y-1.5 pr-1">
              {filteredRules.map((r) => {
                const isSelected = r.id === selectedRuleId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRuleId(r.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? "border-primary bg-primary-soft/40 shadow-xs"
                        : "border-line bg-surface hover:bg-bg text-ink"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono font-bold text-[11px] text-primary">{r.id}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-semibold uppercase ${
                          r.escalate_to === "EMERGENCY"
                            ? "bg-emergency/15 text-emergency"
                            : r.escalate_to === "URGENT"
                            ? "bg-urgent/15 text-urgent"
                            : "bg-routine/15 text-routine"
                        }`}
                      >
                        {r.escalate_to}
                      </span>
                    </div>
                    <div className="font-medium text-ink line-clamp-1">{r.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rule Detail Form */}
          <div className="lg:col-span-8 rounded-xl border border-line bg-surface p-5 shadow-card space-y-4">
            {selectedRule ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <div>
                    <h3 className="font-heading font-bold text-sm text-ink">{selectedRule.name}</h3>
                    <span className="font-mono text-xs text-muted">{selectedRule.id}</span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-bg border border-line text-muted">
                    {selectedRule.validation_status || "ACTIVE"}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-ink mb-1">Rule Name / Clinical Label:</label>
                    <input
                      type="text"
                      value={selectedRule.name}
                      onChange={(e) => handleRuleChange("name", e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-line bg-bg/50 text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-ink mb-1">
                      Condition Logic Expression (<code className="text-primary font-mono">applies_if</code>):
                    </label>
                    <textarea
                      rows={2}
                      value={selectedRule.applies_if}
                      onChange={(e) => handleRuleChange("applies_if", e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-line bg-bg font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-ink mb-1">Escalate To Triage Level:</label>
                      <select
                        value={selectedRule.escalate_to}
                        onChange={(e) => handleRuleChange("escalate_to", e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="EMERGENCY">EMERGENCY (Immediate 112/108)</option>
                        <option value="URGENT">URGENT (&lt; 2h Clinical Evaluation)</option>
                        <option value="ROUTINE">ROUTINE (Primary Care Clinic)</option>
                        <option value="SELF_CARE">SELF_CARE (Home Monitoring)</option>
                        <option value="INFO">INFO (Non-escalating Flag)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-ink mb-1">Forbidden Downstream Levels:</label>
                      <input
                        type="text"
                        value={selectedRule.forbid_levels.join(", ")}
                        onChange={(e) =>
                          handleRuleChange(
                            "forbid_levels",
                            e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                          )
                        }
                        placeholder="e.g. SELF_CARE, ROUTINE"
                        className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-ink mb-1">
                      Emergency Override Condition (<code className="text-emergency font-mono">escalate_to_emergency_if</code>):
                    </label>
                    <input
                      type="text"
                      value={selectedRule.escalate_to_emergency_if || ""}
                      onChange={(e) => handleRuleChange("escalate_to_emergency_if", e.target.value || null)}
                      placeholder="e.g. temp_abnormal or sbp_lt_100 or spo2_lt_92"
                      className="w-full p-2.5 rounded-lg border border-line bg-bg font-mono text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-ink mb-1">Clinical Evidence & Guideline Citations:</label>
                    <textarea
                      rows={2}
                      value={selectedRule.refs || ""}
                      onChange={(e) => handleRuleChange("refs", e.target.value)}
                      placeholder="e.g. NICE NG232; Canadian CT Head Rule (2023 Update)"
                      className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-muted text-xs">Select a rule from the left panel to inspect or edit.</div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REAL 60-CASE IMPACT PREVIEW */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          {impactResult ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-line bg-surface shadow-xs">
                  <span className="text-xs text-muted block mb-1">Synthetic Suite Size</span>
                  <span className="font-heading font-bold text-xl text-ink">
                    {impactResult.total_cases} Cases (120 Twins)
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-line bg-surface shadow-xs">
                  <span className="text-xs text-muted block mb-1">Complete Twin Sensitivity</span>
                  <span
                    className={`font-heading font-bold text-xl ${
                      impactResult.complete_twin_sensitivity >= 1.0 ? "text-selfcare" : "text-emergency"
                    }`}
                  >
                    {(impactResult.complete_twin_sensitivity * 100).toFixed(1)}%
                    {impactResult.complete_twin_sensitivity >= 1.0 ? " (100% Target)" : " (VIOLATION)"}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-line bg-surface shadow-xs">
                  <span className="text-xs text-muted block mb-1">Under-Triaged Regressions</span>
                  <span
                    className={`font-heading font-bold text-xl ${
                      impactResult.regressions_count === 0 ? "text-selfcare" : "text-emergency"
                    }`}
                  >
                    {impactResult.regressions_count} cases
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-line bg-surface shadow-xs">
                  <span className="text-xs text-muted block mb-1">Regression Suite Gate</span>
                  <span
                    className={`font-heading font-bold text-xl uppercase ${
                      impactResult.suite_status === "PASSED" ? "text-selfcare" : "text-emergency"
                    }`}
                  >
                    {impactResult.suite_status === "PASSED" ? "GATE PASSED" : "GATE BLOCKED"}
                  </span>
                </div>
              </div>

              {/* BLOCKED WARNING BANNER WHEN REGRESSIONS EXIST */}
              {impactResult.suite_status === "FAILED" && (
                <div
                  id="clinical-regression-gate-alert"
                  className="p-4 rounded-xl border border-emergency/40 bg-emergency/10 text-emergency space-y-2 text-xs"
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>CRITICAL CLINICAL GOVERNANCE GATE TRIGGERED: RELEASE BLOCKED</span>
                  </div>
                  <p className="leading-relaxed">
                    The draft rule changes caused <strong>{impactResult.regressions_count} acute cases</strong> to drop below required clinical acuity thresholds.
                    Under statutory clinical governance rules, publishing this version is strictly blocked by the backend until all regressions are rectified.
                  </p>

                  <div className="mt-3 pt-3 border-t border-emergency/30 space-y-1.5 font-mono text-[11px]">
                    <span className="font-bold uppercase tracking-wider block">Failing Synthetic Regression Cases:</span>
                    {impactResult.regressions.map((reg, idx) => (
                      <div key={idx} className="p-2 rounded bg-surface border border-emergency/30 text-ink">
                        <span className="font-bold text-emergency mr-2">[{reg.case_id}]</span>
                        <span className="font-semibold text-ink">{reg.case_name}: </span>
                        <span className="text-muted">{reg.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-Case Deltas Table */}
              <div className="rounded-xl border border-line bg-surface shadow-card overflow-hidden">
                <div className="p-4 border-b border-line flex items-center justify-between">
                  <h3 className="font-heading font-bold text-sm text-ink">
                    Synthetic Case Acuity Deltas ({impactResult.deltas.length})
                  </h3>
                  <span className="text-xs text-muted font-mono">Real-time Cycle 3 Evaluator</span>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-bg text-muted border-b border-line font-mono text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4">Case ID</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4">Base Level</th>
                        <th className="py-2.5 px-4">Draft Level</th>
                        <th className="py-2.5 px-4">Confidence Band</th>
                        <th className="py-2.5 px-4">Acuity Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {impactResult.deltas.map((d) => (
                        <tr key={d.case_id} className="hover:bg-bg/50">
                          <td className="py-2.5 px-4 font-mono font-medium text-ink">{d.case_id}</td>
                          <td className="py-2.5 px-4 text-ink">{d.category_name}</td>
                          <td className="py-2.5 px-4 font-mono">{d.base_level}</td>
                          <td className="py-2.5 px-4 font-mono font-semibold">{d.draft_level}</td>
                          <td className="py-2.5 px-4 font-mono text-muted">{d.draft_band}</td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${
                                d.delta === "ESCALATED"
                                  ? "bg-urgent/15 text-urgent"
                                  : d.delta === "DE-ESCALATED"
                                  ? "bg-emergency/15 text-emergency"
                                  : "bg-bg text-muted"
                              }`}
                            >
                              {d.delta}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center rounded-xl border border-line bg-surface text-muted space-y-3">
              <Play className="w-8 h-8 mx-auto text-primary opacity-60" />
              <p className="text-xs">No impact preview run yet for the current draft.</p>
              <button
                type="button"
                onClick={handleRunImpactPreview}
                disabled={previewLoading}
                className="px-4 py-2 rounded-lg bg-primary text-surface text-xs font-semibold hover:bg-primary/95 shadow-button"
              >
                {previewLoading ? "Evaluating Suite..." : "Execute 60-Case Suite Impact Preview"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DIFF VIEWER */}
      {activeTab === "diff" && (
        <div className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <h3 className="font-heading font-bold text-sm text-ink">
              Side-by-Side Version Diff (Active Published vs Draft)
            </h3>
            <span className="text-xs text-muted font-mono">
              Published: {publishedRules.length} | Draft: {rules.length}
            </span>
          </div>

          <div className="space-y-3">
            {rules.map((draftR) => {
              const baseR = publishedRules.find((r) => r.id === draftR.id);
              const isModified =
                !baseR ||
                baseR.applies_if !== draftR.applies_if ||
                baseR.escalate_to !== draftR.escalate_to ||
                baseR.name !== draftR.name;

              if (!isModified) return null;

              return (
                <div key={draftR.id} className="p-3.5 rounded-xl border border-line bg-bg/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-primary">{draftR.id}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-urgent/15 text-urgent font-bold">
                      MODIFIED
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-line">
                    <div className="p-2.5 rounded bg-surface border border-line">
                      <span className="text-[10px] font-mono uppercase text-muted block mb-1">Baseline Published</span>
                      <div className="font-medium text-ink mb-1">{baseR?.name || "[New Rule]"}</div>
                      <code className="text-[11px] font-mono text-muted block whitespace-pre-wrap">
                        {baseR?.applies_if || ""}
                      </code>
                      <span className="mt-2 inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-bg text-muted">
                        Escalate: {baseR?.escalate_to}
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-surface border border-primary/30">
                      <span className="text-[10px] font-mono uppercase text-primary block mb-1">Draft Revision</span>
                      <div className="font-medium text-ink mb-1">{draftR.name}</div>
                      <code className="text-[11px] font-mono text-ink block whitespace-pre-wrap">
                        {draftR.applies_if}
                      </code>
                      <span className="mt-2 inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary-soft text-primary font-bold">
                        Escalate: {draftR.escalate_to}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: IMPORT / EXPORT */}
      {activeTab === "io" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4 text-xs">
            <h3 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              <span>Import Rule Set</span>
            </h3>
            <div>
              <label className="block text-muted mb-1 font-semibold">Format:</label>
              <select
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value as any)}
                className="w-full p-2 rounded-lg border border-line bg-bg text-ink"
              >
                <option value="json">JSON Format</option>
                <option value="yaml">YAML Format</option>
                <option value="csv">CSV Format</option>
              </select>
            </div>
            <textarea
              rows={8}
              value={importContent}
              onChange={(e) => setImportContent(e.target.value)}
              placeholder="Paste rule set payload here in JSON, YAML, or CSV..."
              className="w-full p-2.5 rounded-lg border border-line bg-bg font-mono text-[11px] text-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={handleImport}
              disabled={loading || !importContent.trim()}
              className="px-4 py-2 rounded-lg bg-primary text-surface font-semibold hover:bg-primary/95 shadow-button"
            >
              Parse & Load into Editor
            </button>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4 text-xs">
            <h3 className="font-heading font-bold text-sm text-ink flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              <span>Export Active Rule Set</span>
            </h3>
            <p className="text-muted leading-relaxed">
              Export the currently loaded rule definitions for external offline backup, clinical quality audits, or version control synchronization.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleExport("json")}
                className="px-4 py-2.5 rounded-lg border border-line hover:bg-bg text-ink font-semibold flex items-center justify-between"
              >
                <span>Export as Structured JSON</span>
                <span className="font-mono text-muted text-[11px]">.json</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport("yaml")}
                className="px-4 py-2.5 rounded-lg border border-line hover:bg-bg text-ink font-semibold flex items-center justify-between"
              >
                <span>Export as Standard YAML</span>
                <span className="font-mono text-muted text-[11px]">.yaml</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport("csv")}
                className="px-4 py-2.5 rounded-lg border border-line hover:bg-bg text-ink font-semibold flex items-center justify-between"
              >
                <span>Export as Tabular CSV</span>
                <span className="font-mono text-muted text-[11px]">.csv</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH DIALOG */}
      {publishModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-popover space-y-4">
            <div className="flex items-center gap-2.5 text-ink">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-bold text-base">Publish Clinical Rules to Runtime</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Publishing will update the live deterministic rules engine for all patients and clinicians.
              The backend will automatically block this action if red-flag sensitivity drops below 100%.
            </p>

            <form onSubmit={handlePublishSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">
                  Mandatory Validated-By Clinical Reviewer (MD / CMO):
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="e.g. Dr. Verified Clinical Officer (Reg #KMC-48291)"
                  required
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Governance Justification & Release Notes:</label>
                <textarea
                  rows={3}
                  value={publishReason}
                  onChange={(e) => setPublishReason(e.target.value)}
                  placeholder="Explain why this clinical rule revision is safe and required..."
                  required
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setPublishModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-line text-muted hover:text-ink font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-primary text-surface font-semibold hover:bg-primary/95 shadow-button disabled:opacity-50"
                >
                  {loading ? "Verifying Gate..." : "Confirm & Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROLLBACK DIALOG */}
      {rollbackModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-popover space-y-4">
            <div className="flex items-center gap-2.5 text-ink">
              <RotateCcw className="w-5 h-5 text-emergency" />
              <h3 className="font-heading font-bold text-base">Rollback Rule Configuration</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Rollback creates a new version with a byte-identical SHA-256 payload matching the chosen target baseline.
            </p>

            <form onSubmit={handleRollbackSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">Target Version to Restore:</label>
                <input
                  type="number"
                  min={1}
                  value={targetRollbackVersion}
                  onChange={(e) => setTargetRollbackVersion(parseInt(e.target.value, 10))}
                  required
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Mandatory Rollback Justification:</label>
                <textarea
                  rows={3}
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Reason for rolling back to prior version..."
                  required
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setRollbackModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-line text-muted hover:text-ink font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-emergency text-surface font-semibold hover:bg-emergency/90 shadow-button"
                >
                  {loading ? "Reverting..." : "Confirm Rollback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

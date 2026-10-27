"use client";

import React, { useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { AIModelsAllowlist } from "@/components/admin/AIModelsAllowlist";
import { PromptRegistry } from "@/components/admin/PromptRegistry";
import { AIUsageDashboard } from "@/components/admin/AIUsageDashboard";
import { Cpu, BarChart3, FileText, Activity } from "lucide-react";

export default function AIControlPage() {
  const [activeTab, setActiveTab] = useState<"usage" | "models" | "prompts">("usage");

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary-soft text-primary uppercase">
                AI Inference & Observability
              </span>
              <span className="text-xs text-muted font-mono">• Zero-PHI Sandboxing</span>
            </div>
            <h1 className="font-heading font-bold text-2xl text-ink">
              AI Control Center & Usage Observability
            </h1>
            <p className="text-xs sm:text-sm text-muted max-w-2xl mt-1 leading-relaxed">
              Configure provider allowlists, test and version prompt templates in a zero-PHI sandbox, monitor real-time token quotas, and drill down from metrics directly into scrubbed audit logs.
            </p>
          </div>

          {/* Primary View Toggle */}
          <div className="inline-flex rounded-xl border border-line bg-surface p-1 text-xs shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab("usage")}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "usage"
                  ? "bg-primary text-surface shadow-button"
                  : "text-muted hover:text-ink"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Usage & Scrubbed Logs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("models")}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "models"
                  ? "bg-primary text-surface shadow-button"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Model Allowlists</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("prompts")}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "prompts"
                  ? "bg-primary text-surface shadow-button"
                  : "text-muted hover:text-ink"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Prompt Registry</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "usage" && <AIUsageDashboard />}
        {activeTab === "models" && <AIModelsAllowlist />}
        {activeTab === "prompts" && <PromptRegistry />}
      </div>
    </AdminLayout>
  );
}

"use client";

import React, { useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { ClinicalRulesEditor } from "@/components/admin/ClinicalRulesEditor";
import { QuestionnairesManager } from "@/components/admin/QuestionnairesManager";
import { QualityLayerParameters } from "@/components/admin/QualityLayerParameters";
import { FileCheck2, FileQuestion, Sliders, ShieldCheck } from "lucide-react";

export default function ClinicalGovernancePage() {
  const [activeTab, setActiveTab] = useState<"rules" | "questionnaires" | "quality">("rules");

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary-soft text-primary uppercase">
                Clinical Safety & Protocols
              </span>
              <span className="text-xs text-muted font-mono">• Statutory Governance</span>
            </div>
            <h1 className="font-heading font-bold text-2xl text-ink">
              Clinical Governance & Protocol Control
            </h1>
            <p className="text-xs sm:text-sm text-muted max-w-2xl mt-1 leading-relaxed">
              Maintain validated clinical protocols, audit regression impact over the 60-case synthetic suite, manage multilingual screening questionnaires, and govern Quality Layer ensemble scoring.
            </p>
          </div>

          {/* Primary View Toggle */}
          <div className="inline-flex rounded-xl border border-line bg-surface p-1 text-xs shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab("rules")}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "rules"
                  ? "bg-primary text-surface shadow-button"
                  : "text-muted hover:text-ink"
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Geriatric Rules</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("questionnaires")}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "questionnaires"
                  ? "bg-primary text-surface shadow-button"
                  : "text-muted hover:text-ink"
              }`}
            >
              <FileQuestion className="w-3.5 h-3.5" />
              <span>Screening Probes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("quality")}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "quality"
                  ? "bg-primary text-surface shadow-button"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Quality Layer Parameters</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "rules" && <ClinicalRulesEditor />}
        {activeTab === "questionnaires" && <QuestionnairesManager />}
        {activeTab === "quality" && <QualityLayerParameters />}
      </div>
    </AdminLayout>
  );
}

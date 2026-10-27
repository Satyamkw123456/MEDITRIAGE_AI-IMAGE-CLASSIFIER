"use client";

import React, { useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { I18nStringEditor } from "@/components/admin/I18nStringEditor";
import { ConsentVersionEditor } from "@/components/admin/ConsentVersionEditor";
import { EmergencyDirectoryEditor } from "@/components/admin/EmergencyDirectoryEditor";
import { AIHubResourceCardEditor } from "@/components/admin/AIHubResourceCardEditor";
import { Languages, FileText, PhoneCall, LayoutGrid } from "lucide-react";

export default function ContentResourcesPage() {
  const [activeTab, setActiveTab] = useState<"i18n" | "consent" | "resources" | "cards">("i18n");

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary-soft text-primary uppercase">
                Content & Public Resources
              </span>
              <span className="text-xs text-muted font-mono">• Multilingual & Compliance</span>
            </div>
            <h1 className="font-heading font-bold text-2xl text-ink">
              Content, Localization & Emergency Directories
            </h1>
            <p className="text-xs sm:text-sm text-muted max-w-2xl mt-1 leading-relaxed">
              Manage multilingual UI strings (EN, HI, MR), bump statutory DPDP consent versions with automated re-consent triggers, maintain emergency facility directories, and author patient AI Hub card copy.
            </p>
          </div>

          {/* Primary View Toggle */}
          <div className="inline-flex rounded-xl border border-line bg-surface p-1 text-xs shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab("i18n")}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "i18n"
                  ? "bg-primary text-surface shadow-button"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Languages className="w-3.5 h-3.5" />
              <span>Translations</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("consent")}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "consent"
                  ? "bg-primary text-surface shadow-button"
                  : "text-muted hover:text-ink"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>DPDP Consent</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("resources")}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "resources"
                  ? "bg-primary text-surface shadow-button"
                  : "text-muted hover:text-ink"
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Emergency Lines</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("cards")}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "cards"
                  ? "bg-primary text-surface shadow-button"
                  : "text-muted hover:text-ink"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>AI Hub Copy</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "i18n" && <I18nStringEditor />}
        {activeTab === "consent" && <ConsentVersionEditor />}
        {activeTab === "resources" && <EmergencyDirectoryEditor />}
        {activeTab === "cards" && <AIHubResourceCardEditor />}
      </div>
    </AdminLayout>
  );
}

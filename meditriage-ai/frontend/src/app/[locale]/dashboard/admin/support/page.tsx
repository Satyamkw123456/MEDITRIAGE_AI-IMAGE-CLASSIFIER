"use client";

import React, { useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { ImpersonationLauncher } from "@/components/admin/ImpersonationLauncher";
import { BreakGlassModal } from "@/components/admin/BreakGlassModal";
import { UserCheck, ShieldAlert, Eye } from "lucide-react";

export default function SupportToolsPage() {
  const [activeTab, setActiveTab] = useState<"impersonate" | "breakglass">("impersonate");

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-urgent/15 text-urgent uppercase">
                Support & Emergency Access
              </span>
              <span className="text-xs text-muted font-mono">• Statutory DPDP Safeguards</span>
            </div>
            <h1 className="font-heading font-bold text-2xl text-ink">
              Support Tools & Break-Glass Access
            </h1>
            <p className="text-xs sm:text-sm text-muted max-w-2xl mt-1 leading-relaxed">
              Launch authorized read-only impersonation sessions to assist patients and clinicians, or execute emergency break-glass PHI reveals with strict TTL countdowns and auditor transparency.
            </p>
          </div>

          {/* Primary View Toggle */}
          <div className="inline-flex rounded-xl border border-line bg-surface p-1 text-xs shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab("impersonate")}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "impersonate"
                  ? "bg-primary text-surface shadow-button"
                  : "text-muted hover:text-ink"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Impersonation Launcher</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("breakglass")}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "breakglass"
                  ? "bg-primary text-surface shadow-button"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Emergency Break-Glass</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "impersonate" && <ImpersonationLauncher />}
        {activeTab === "breakglass" && <BreakGlassModal />}
      </div>
    </AdminLayout>
  );
}

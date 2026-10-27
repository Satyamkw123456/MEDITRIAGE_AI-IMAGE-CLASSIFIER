"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ShieldCheck, FileLock, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DataRightsQueue } from "@/components/admin/DataRightsQueue";
import { LegalHoldManager } from "@/components/admin/LegalHoldManager";
import { ConsentLedgerViewer } from "@/components/admin/ConsentLedgerViewer";

export default function DPDPDataRightsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") || "requests";
  const filterParam = searchParams.get("filter") || "";

  const [activeTab, setActiveTab] = useState<"requests" | "holds" | "ledger">("requests");

  useEffect(() => {
    if (tabParam === "holds" || tabParam === "ledger" || tabParam === "requests") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const switchTab = (tab: "requests" | "holds" | "ledger") => {
    setActiveTab(tab);
    router.replace(`/dashboard/admin/dpdp?tab=${tab}`);
  };

  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted mb-1">
                <Link href="/dashboard/admin" className="hover:text-primary transition-colors flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Command Room</span>
                </Link>
                <span>/</span>
                <span className="text-ink font-medium">Compliance & Rights</span>
              </div>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
                DPDP Data Rights & Consent Plane
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Statutory fulfillment of patient data erasure, rectification, litigation holds, and digital consent telemetry under DPDP Act 2023.
              </p>
            </div>

            {/* Navigation Tabs */}
            <div className="inline-flex rounded-xl border border-line bg-surface p-1 shadow-xs text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => switchTab("requests")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "requests"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Data Rights Queue</span>
              </button>
              <button
                type="button"
                onClick={() => switchTab("holds")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "holds"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <FileLock className="w-3.5 h-3.5" />
                <span>Litigation Legal Holds</span>
              </button>
              <button
                type="button"
                onClick={() => switchTab("ledger")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "ledger"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Consent Ledger</span>
              </button>
            </div>
          </div>

          {activeTab === "requests" && <DataRightsQueue overdueOnly={filterParam === "overdue"} />}
          {activeTab === "holds" && <LegalHoldManager />}
          {activeTab === "ledger" && <ConsentLedgerViewer />}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

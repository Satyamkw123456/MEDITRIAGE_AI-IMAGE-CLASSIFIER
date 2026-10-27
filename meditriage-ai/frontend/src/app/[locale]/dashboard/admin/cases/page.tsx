"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Clock, Search, ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { OversightWorklists } from "@/components/admin/OversightWorklists";
import { MetadataSearch } from "@/components/admin/MetadataSearch";

export default function CaseOversightPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterParam = searchParams.get("filter") || "unreviewed";

  const [activeTab, setActiveTab] = useState<"worklists" | "search">("worklists");
  const [currentFilter, setCurrentFilter] = useState<string>(filterParam);

  useEffect(() => {
    if (filterParam === "search") {
      setActiveTab("search");
    } else {
      setActiveTab("worklists");
      setCurrentFilter(filterParam);
    }
  }, [filterParam]);

  const switchTab = (tab: "worklists" | "search") => {
    setActiveTab(tab);
    if (tab === "search") router.replace("/dashboard/admin/cases?filter=search");
    else router.replace(`/dashboard/admin/cases?filter=${currentFilter || "unreviewed"}`);
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
                <span className="text-ink font-medium">Operations</span>
              </div>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
                Case & Queue Oversight
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Monitor triage SLA breaches, low-confidence algorithmic backlogs, and execute emergency clinician reassignments.
              </p>
            </div>

            {/* View Switcher */}
            <div className="inline-flex rounded-xl border border-line bg-surface p-1 shadow-xs text-xs">
              <button
                type="button"
                onClick={() => switchTab("worklists")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === "worklists"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Actionable Worklists</span>
              </button>
              <button
                type="button"
                onClick={() => switchTab("search")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === "search"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Zero-PHI Search</span>
              </button>
            </div>
          </div>

          {activeTab === "worklists" && <OversightWorklists initialWorklist={currentFilter} />}
          {activeTab === "search" && <MetadataSearch />}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

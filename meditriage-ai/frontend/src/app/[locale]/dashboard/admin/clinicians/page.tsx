"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { ClinicianVerificationQueue } from "@/components/admin/ClinicianVerificationQueue";
import { WorldPriceIndex } from "@/components/admin/WorldPriceIndex";
import { 
  FileCheck2, 
  Globe2, 
  Coins, 
  Building2, 
  ShieldCheck, 
  Activity,
  ArrowRight,
  ExternalLink
} from "lucide-react";

export default function AdminCliniciansPage() {
  const [activeTab, setActiveTab] = useState<"verification" | "world-prices" | "tariffs">("verification");

  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-soft text-primary font-mono text-xs font-semibold">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  Clinician Operations & Intelligence
                </span>
                <span className="font-mono text-xs text-muted">
                  Registry: Active
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold text-ink tracking-tight">
                Clinician Credentialing & Global Tariff Intelligence
              </h1>
              <p className="text-xs sm:text-sm text-muted max-w-2xl mt-1">
                Verify practicing clinician credentials, regulate prescribing & triage authority, and monitor cross-border clinical procedure price benchmarks powered by Stitch AI.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/admin/world-prices"
                className="px-3.5 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold hover:bg-teal-100 flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Globe2 className="w-4 h-4 text-teal-600" />
                <span>World Medical Prices</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </Link>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-line pb-1">
            <button
              type="button"
              onClick={() => setActiveTab("verification")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeTab === "verification"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted hover:text-ink hover:bg-surface"
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Clinician Verification Queue</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("world-prices")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeTab === "world-prices"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-muted hover:text-ink hover:bg-surface"
              }`}
            >
              <Globe2 className="w-4 h-4" />
              <span>World Medical Price Index (Stitch AI)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("tariffs")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeTab === "tariffs"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted hover:text-ink hover:bg-surface"
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Cross-Border Clinician Tariffs</span>
            </button>
          </div>

          {/* Tab 1: Credential Verification */}
          {activeTab === "verification" && (
            <div className="space-y-4">
              <ClinicianVerificationQueue />
            </div>
          )}

          {/* Tab 2: Stitch AI World Price Index */}
          {activeTab === "world-prices" && (
            <div className="space-y-4">
              <WorldPriceIndex />
            </div>
          )}

          {/* Tab 3: Cross-Border Tariffs */}
          {activeTab === "tariffs" && (
            <div className="space-y-4">
              <div className="rounded-card border border-line bg-surface p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Clinician tariff normalization ensures cross-border medical consultation fees are benchmarked transparently against purchasing power parity (PPP).
                  </span>
                </div>
                <WorldPriceIndex />
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

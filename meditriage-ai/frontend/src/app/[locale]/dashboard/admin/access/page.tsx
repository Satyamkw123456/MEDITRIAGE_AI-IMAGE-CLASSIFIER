"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Users, Shield, FileCheck2, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { UserDirectoryTable } from "@/components/admin/UserDirectoryTable";
import { PermissionMatrixEditor } from "@/components/admin/PermissionMatrixEditor";
import { ClinicianVerificationQueue } from "@/components/admin/ClinicianVerificationQueue";
import { LockoutMonitor } from "@/components/admin/LockoutMonitor";
import { CaregiverLinksPanel } from "@/components/admin/CaregiverLinksPanel";

export default function IdentityAccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") || "users";

  const [activeTab, setActiveTab] = useState<"users" | "matrix" | "clinicians" | "lockouts" | "caregivers">("users");

  useEffect(() => {
    if (tabParam === "matrix" || tabParam === "clinicians" || tabParam === "lockouts" || tabParam === "users" || tabParam === "caregivers") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const setTab = (tab: "users" | "matrix" | "clinicians" | "lockouts" | "caregivers") => {
    setActiveTab(tab);
    router.replace(`/dashboard/admin/access?tab=${tab}`);
  };

  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Top Breadcrumb & Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted mb-1">
                <Link href="/dashboard/admin" className="hover:text-primary transition-colors flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Command Room</span>
                </Link>
                <span>/</span>
                <span className="text-ink font-medium">Identity & Access</span>
              </div>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
                Identity & Access Control Plane
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Manage user lifecycle, enforce RBAC permission matrices, verify clinician credentials, and guard against lockouts.
              </p>
            </div>

            {/* Tab Pills */}
            <div className="inline-flex rounded-xl border border-line bg-surface p-1 shadow-xs text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setTab("users")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "users"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>User Directory</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("matrix")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "matrix"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Permissions Matrix (Spike)</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("clinicians")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "clinicians"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Clinician Verification</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("lockouts")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "lockouts"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lockout Monitor</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("caregivers")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "caregivers"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Caregiver Links</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "users" && <UserDirectoryTable />}
          {activeTab === "matrix" && <PermissionMatrixEditor />}
          {activeTab === "clinicians" && <ClinicianVerificationQueue />}
          {activeTab === "lockouts" && <LockoutMonitor />}
          {activeTab === "caregivers" && <CaregiverLinksPanel />}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

"use client";

import React from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { ClinicianVerificationQueue } from "@/components/admin/ClinicianVerificationQueue";
import { FileCheck2, ShieldCheck, UserCheck } from "lucide-react";

export default function AdminCliniciansPage() {
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
                  Clinician Oversight
                </span>
                <span className="font-mono text-xs text-muted">
                  NMC Statutory Verification
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold text-ink tracking-tight">
                Clinician Verification & Credential Management
              </h1>
              <p className="text-xs sm:text-sm text-muted max-w-2xl mt-1">
                Review pending practitioner credentials, inspect statutory medical council registrations, and grant clinical triage and prescribing privileges.
              </p>
            </div>
          </div>

          {/* Clinician Verification Queue */}
          <ClinicianVerificationQueue />
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

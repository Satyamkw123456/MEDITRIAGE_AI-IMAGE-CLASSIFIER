"use client";

import React from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GitPullRequest, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ApprovalsCenter } from "@/components/admin/ApprovalsCenter";

export default function ApprovalsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin", "clinical_admin"]}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted mb-1">
                <Link href="/dashboard/admin" className="hover:text-primary transition-colors flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Command Room</span>
                </Link>
                <span>/</span>
                <span className="text-ink font-medium">Dual-Control</span>
              </div>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
                Approvals Center
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Review pending dual-control actions, inspect proposed state diffs, and authorize high-impact operations.
              </p>
            </div>
          </div>

          <ApprovalsCenter />
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

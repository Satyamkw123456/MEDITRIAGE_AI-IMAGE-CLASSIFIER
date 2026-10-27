"use client";

import React from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { WorldPriceIndex } from "@/components/admin/WorldPriceIndex";

export default function AdminWorldPricesPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
      <AdminLayout>
        <WorldPriceIndex />
      </AdminLayout>
    </ProtectedRoute>
  );
}

"use client";

import React from "react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { WorldPriceIndex } from "@/components/admin/WorldPriceIndex";

export default function PublicWorldPricesPage() {
  return (
    <PatientLayout>
      <div className="max-w-6xl mx-auto py-6 px-4">
        <WorldPriceIndex />
      </div>
    </PatientLayout>
  );
}

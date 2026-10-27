"use client";

import React from "react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { EmergencyCardManager } from "@/components/emergency/EmergencyCardManager";

export default function PatientEmergencyCardPage() {
  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto py-2">
        <EmergencyCardManager />
      </div>
    </PatientLayout>
  );
}

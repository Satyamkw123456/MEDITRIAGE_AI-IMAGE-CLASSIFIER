"use client";

import React from "react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { CaregiverManager } from "@/components/caregiver/CaregiverManager";

export default function PatientCaregiversPage() {
  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto py-2">
        <CaregiverManager />
      </div>
    </PatientLayout>
  );
}

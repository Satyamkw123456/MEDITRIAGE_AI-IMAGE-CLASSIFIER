"use client";

import React from "react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { IntakeWizardV2 } from "@/components/triage/IntakeWizardV2";

export default function IntakePage() {
  return (
    <PatientLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <IntakeWizardV2 />
      </div>
    </PatientLayout>
  );
}

"use client";

import React from "react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { PublicResourceDirectory } from "@/components/resources/PublicResourceDirectory";

export default function ResourcesPage() {
  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto py-2">
        <PublicResourceDirectory />
      </div>
    </PatientLayout>
  );
}

"use client";

import React from "react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { ShieldCheck, Lock, EyeOff, FileText, CheckCircle2 } from "lucide-react";

export default function PrivacyPage() {
  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="rounded-card border border-line bg-surface p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-soft text-primary font-mono text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Statutory Compliance
            </span>
            <span className="font-mono text-xs text-muted">DPDP Act 2023 Enforced</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-ink tracking-tight">
            Digital Personal Data Protection (DPDP) Act 2023 Principles
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            MediTriage AI operates under stringent Indian DPDP Act 2023 regulations and international patient confidentiality standards. Personal Health Information (PHI) is encrypted at rest, in transit, and strictly isolated from generative AI model weights.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-line text-xs">
            <div className="p-4 rounded-xl border border-line bg-bg space-y-2">
              <div className="flex items-center gap-2 font-bold text-ink">
                <Lock className="w-4 h-4 text-primary" />
                <span>Zero-Retention AI Gateway</span>
              </div>
              <p className="text-muted leading-relaxed">
                Clinical intake text is de-identified and anonymized before passing through local or cloud LLM consensus ensembles. No patient identifiers are ever stored in generative AI logs.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-line bg-bg space-y-2">
              <div className="flex items-center gap-2 font-bold text-ink">
                <EyeOff className="w-4 h-4 text-selfcare" />
                <span>Statutory Right to Erasure</span>
              </div>
              <p className="text-muted leading-relaxed">
                Patients maintain full sovereignty over their health data. Cryptographic shredding requests can be initiated at any time via the patient portal with complete auditor traceability.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PatientLayout>
  );
}

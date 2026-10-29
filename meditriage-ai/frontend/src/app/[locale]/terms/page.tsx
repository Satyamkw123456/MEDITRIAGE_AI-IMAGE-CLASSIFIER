"use client";

import React from "react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { Stethoscope, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";

export default function TermsPage() {
  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="rounded-card border border-line bg-surface p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-urgent/10 text-urgent font-mono text-xs font-semibold">
              <Stethoscope className="w-3.5 h-3.5" />
              Clinical Governance
            </span>
            <span className="font-mono text-xs text-muted">Legal Mandate</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-ink tracking-tight">
            Clinician Supremacy Mandate & Terms of Clinical Service
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            MediTriage AI is a Clinical Decision-Support System (CDSS) designed specifically to assist with geriatric triage evaluation. Under Indian National Medical Commission (NMC) statutes and international clinical protocols, the practicing human clinician always maintains final authoritative supremacy.
          </p>

          <div className="space-y-3 pt-4 border-t border-line text-xs">
            <div className="p-4 rounded-xl border border-line bg-bg space-y-2">
              <h3 className="font-bold text-ink text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-selfcare" />
                <span>1. Clinician Supremacy & Non-Delegable Responsibility</span>
              </h3>
              <p className="text-muted leading-relaxed">
                Algorithmic triage outputs (routine, urgent, emergent) are preliminary decision-support recommendations. A verified, registered medical practitioner must validate or override every recommendation before patient discharge or medication prescription.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-line bg-bg space-y-2">
              <h3 className="font-bold text-ink text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-urgent" />
                <span>2. Emergency Medical Conditions</span>
              </h3>
              <p className="text-muted leading-relaxed">
                MediTriage is not an emergency hotline. In the event of acute chest pain, sudden numbness or paralysis, severe breathlessness, or loss of consciousness, patients and caregivers must dial 112 / 108 immediately or report to the nearest emergency room.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PatientLayout>
  );
}

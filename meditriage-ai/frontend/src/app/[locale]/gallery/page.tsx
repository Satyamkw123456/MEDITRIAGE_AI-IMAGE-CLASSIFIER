"use client";

import React, { useState } from "react";
import { useLocale } from "next-intl";
import { 
  TrustStrip 
} from "@/components/shared/TrustStrip";
import { 
  TriageBanner 
} from "@/components/shared/TriageBanner";
import { 
  ConfidenceBadge 
} from "@/components/shared/ConfidenceBadge";
import { 
  RevisionTimeline, 
  TimelineEvent 
} from "@/components/shared/RevisionTimeline";
import { 
  DiffViewer, 
  DiffLine 
} from "@/components/shared/DiffViewer";
import { 
  DataTable, 
  Column 
} from "@/components/shared/DataTable";
import { 
  ReasonDialog 
} from "@/components/shared/ReasonDialog";
import { 
  StepUpDialog 
} from "@/components/shared/StepUpDialog";
import { 
  ConfirmTypeToProceed 
} from "@/components/shared/ConfirmTypeToProceed";
import { 
  EmptyState 
} from "@/components/shared/EmptyState";
import { 
  SkeletonLoader 
} from "@/components/shared/SkeletonLoader";
import { 
  ErrorState 
} from "@/components/shared/ErrorState";
import { 
  OfflineBanner 
} from "@/components/shared/OfflineBanner";
import { 
  AIUnavailableBanner 
} from "@/components/shared/AIUnavailableBanner";
import { 
  PartialDataBanner 
} from "@/components/shared/PartialDataBanner";
import { 
  LanguageSwitcher 
} from "@/components/shared/LanguageSwitcher";
import { 
  PatientLayout 
} from "@/components/layouts/PatientLayout";
import { 
  Eye, 
  Sliders, 
  ShieldCheck, 
  Check, 
  Layers 
} from "lucide-react";

interface SampleUser {
  id: string;
  name: string;
  role: string;
  department: string;
  status: "Active" | "Pending" | "Suspended";
}

const SAMPLE_USERS: SampleUser[] = [
  { id: "USR-001", name: "Dr. Ananya Sharma", role: "Attending Physician", department: "Emergency Medicine", status: "Active" },
  { id: "USR-002", name: "Dr. Rajesh Kulkarni", role: "Chief Medical Officer", department: "Clinical Governance", status: "Active" },
  { id: "USR-003", name: "Priya Nair", role: "Triage Nurse Specialist", department: "Outpatient Care", status: "Active" },
  { id: "USR-004", name: "Amitabh Verma", role: "System Administrator", department: "IT Security", status: "Active" },
  { id: "USR-005", name: "Sunita Deshmukh", role: "Compliance Officer", department: "DPDP / Legal", status: "Pending" },
];

const SAMPLE_EVENTS: TimelineEvent[] = [
  {
    id: "evt-1",
    timestamp: "2026-09-30 21:14:02 IST",
    actorName: "Dr. Rajesh Kulkarni",
    actorRole: "CLINICAL_ADMIN",
    action: "Triage Level Escalated",
    summary: "Escalated patient case from Routine to Emergent due to acute diaphoresis and radiating jaw pain.",
    isOverride: true,
    category: "Clinical Override",
    previousValue: "triage_level: 'routine'\nconfidence: 0.72\nroute: 'outpatient_clinic'",
    newValue: "triage_level: 'emergent'\nconfidence: 0.98\nroute: 'cardiac_resuscitation_bay'",
    reason: "Patient reports sudden onset crushing substernal discomfort with autonomic diaphoresis. Clinical judgment dictates immediate catheterization lab standby.",
  },
  {
    id: "evt-2",
    timestamp: "2026-09-30 20:45:10 IST",
    actorName: "MediTriage Engine (v2.4)",
    actorRole: "AUTOMATED_AI",
    action: "Initial Algorithmic Assessment",
    summary: "Automated symptom intake processed with deterministic safety rules checked.",
    isOverride: false,
    category: "AI Intake",
  },
];

const OLD_CONFIG = `rule "Chest Pain Safety Protocol"
  version: 1.0.4
  threshold: 0.85
  requires_ecg: false
  escalate_on_diaphoresis: false`;

const NEW_CONFIG = `rule "Chest Pain Safety Protocol"
  version: 1.1.0
  threshold: 0.75
  requires_ecg: true
  escalate_on_diaphoresis: true
  mandatory_cardiac_consult: true`;

export default function GalleryPage() {
  const locale = useLocale();

  // Modal test states
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [showStepUpDialog, setShowStepUpDialog] = useState(false);
  const [showConfirmType, setShowConfirmType] = useState(false);
  const [dialogResult, setDialogResult] = useState<string | null>(null);

  const columns: Column<SampleUser>[] = [
    { key: "id", header: "User ID", sortable: true, className: "font-mono text-xs text-muted" },
    { key: "name", header: "Full Name", sortable: true, className: "font-medium text-ink" },
    { key: "role", header: "Clinical / System Role", sortable: true },
    { key: "department", header: "Department", sortable: true, className: "text-muted" },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (user) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            user.status === "Active"
              ? "bg-selfcare/10 text-selfcare border border-selfcare/20"
              : "bg-urgent/10 text-urgent border border-urgent/20"
          }`}
        >
          {user.status}
        </span>
      ),
    },
  ];

  return (
    <PatientLayout>
      <div className="space-y-12">
        {/* Gallery Intro Banner */}
        <section className="rounded-card border border-line bg-surface p-6 sm:p-8 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-soft text-primary font-mono text-xs font-semibold mb-3 border border-primary/20">
                <Layers className="w-3.5 h-3.5" />
                Phase 2 • Cycle 08 Shared Component Gallery
              </span>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
                Design System & Living Component Library
              </h1>
              <p className="text-muted text-sm max-w-2xl mt-1.5 leading-relaxed">
                Light, bright, premium healthcare design tokens, multilingual typography (EN / HI / MR), accessible interactive widgets, and clinical safety banners.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher variant="pills" />
            </div>
          </div>
        </section>

        {/* 1. Triage Banner Showcase */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-xl text-ink">1. Clinical Triage Banners</h2>
            <span className="text-xs text-muted font-mono">4 Urgency Categories</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <TriageBanner
              level="EMERGENCY"
              headline="Emergent (Level 1) — Immediate Resuscitation Required"
              rationale="Life-threatening presentation detected. Medical attention required immediately without delay."
              actionText="Emergency Response"
              showEmergencyCall={true}
            />
            <TriageBanner
              level="URGENT"
              headline="Urgent (Level 2) — Rapid Clinical Evaluation"
              rationale="Significant symptoms identified that require prompt clinical assessment and diagnostic workup."
              actionText="Urgent Care Center"
            />
            <TriageBanner
              level="ROUTINE"
              headline="Routine (Level 3) — Scheduled Outpatient Consultation"
              rationale="Symptoms are stable and suitable for regular scheduled clinical follow-up."
              actionText="Schedule Clinic Visit"
            />
            <TriageBanner
              level="SELF_CARE"
              headline="Self-Care (Level 4) — Home Care & Symptom Monitoring"
              rationale="Mild symptoms manageable at home with proper rest, hydration, and observation."
              actionText="View Self-Care Guide"
            />
          </div>
        </section>

        {/* 2. Confidence Badges & Trust Strip */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-xl text-ink">2. Trust Indicators & Confidence</h2>
            <span className="text-xs text-muted font-mono">INV-13 Clinical Explainability</span>
          </div>

          <div className="rounded-card border border-line bg-surface p-6 shadow-card space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Confidence Badges (Shape + Text)</h3>
              <div className="flex flex-wrap items-center gap-3">
                <ConfidenceBadge band="HIGH" score={0.94} showScore={true} />
                <ConfidenceBadge band="MEDIUM" score={0.71} showScore={true} />
                <ConfidenceBadge band="LOW" score={0.42} showScore={true} />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Trust Strip Widget</h3>
              <TrustStrip
                level="URGENT"
                confidenceScore={0.88}
                confidenceBand="HIGH"
                redFlagsCount={0}
                redFlagsEvaluated={true}
                missingDataFields={["Blood Pressure", "Prior Cardiac History"]}
                reviewStatus="IN_REVIEW"
              />
            </div>
          </div>
        </section>

        {/* 3. System States & Banners */}
        <section className="space-y-4">
          <h2 className="font-heading font-semibold text-xl text-ink">3. Resilient Operational Banners</h2>
          <div className="space-y-3">
            <OfflineBanner pendingMutationsCount={3} />
            <AIUnavailableBanner reason="Primary LLM latency exceeded SLA threshold (5000ms)." />
            <PartialDataBanner missingSources={["Regional EHR Sync (EPIC)", "Patient Wearable Stream"]} />
          </div>
        </section>

        {/* 4. Revision Timeline */}
        <section className="space-y-4">
          <h2 className="font-heading font-semibold text-xl text-ink">4. Audit & Revision Timeline</h2>
          <RevisionTimeline events={SAMPLE_EVENTS} />
        </section>

        {/* 5. Diff Viewer */}
        <section className="space-y-4">
          <h2 className="font-heading font-semibold text-xl text-ink">5. Rule & Config Diff Viewer</h2>
          <DiffViewer
            title="Clinical Safety Rule: Chest Pain Protocol (v1.0.4 -> v1.1.0)"
            oldVersionLabel="Production Active (v1.0.4)"
            newVersionLabel="Shadow Candidate (v1.1.0)"
            oldContent={OLD_CONFIG}
            newContent={NEW_CONFIG}
          />
        </section>

        {/* 6. DataTable */}
        <section className="space-y-4">
          <h2 className="font-heading font-semibold text-xl text-ink">6. Accessible Data Table</h2>
          <DataTable
            data={SAMPLE_USERS}
            columns={columns}
            keyExtractor={(u) => u.id}
            pageSize={3}
            searchPlaceholder="Search personnel by name or department..."
          />
        </section>

        {/* 7. Dialogs & Interactive Controls */}
        <section className="space-y-4">
          <h2 className="font-heading font-semibold text-xl text-ink">7. Guarded Dialogs & Workflows</h2>
          <div className="rounded-card border border-line bg-surface p-6 shadow-card space-y-4">
            <p className="text-sm text-muted">
              Trigger high-privilege operational and clinical verification dialogs:
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowReasonDialog(true)}
                className="px-4 py-2 rounded-lg bg-primary text-surface text-sm font-semibold hover:bg-primary/95 transition-colors shadow-button"
              >
                Open ReasonDialog
              </button>

              <button
                type="button"
                onClick={() => setShowStepUpDialog(true)}
                className="px-4 py-2 rounded-lg border border-line bg-surface text-ink text-sm font-semibold hover:bg-bg transition-colors shadow-xs"
              >
                Open StepUpDialog (MFA)
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmType(true)}
                className="px-4 py-2 rounded-lg bg-emergency text-surface text-sm font-semibold hover:bg-emergency/90 transition-colors shadow-button"
              >
                Open ConfirmTypeToProceed
              </button>
            </div>

            {dialogResult && (
              <div className="p-3 rounded-lg bg-selfcare/10 border border-selfcare/20 text-xs text-selfcare font-mono">
                Last Dialog Result: {dialogResult}
              </div>
            )}
          </div>
        </section>

        {/* 8. Empty & Error States */}
        <section className="space-y-4">
          <h2 className="font-heading font-semibold text-xl text-ink">8. Empty & Error States</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EmptyState
              title="No Open Triage Cases"
              description="All patient admissions have been reviewed and dispatched to their designated care pathways."
              primaryActionLabel="Refresh Worklist"
              onPrimaryAction={() => alert("Refreshed")}
            />
            <ErrorState
              title="Service Gateway Timeout"
              message="The clinical registry service did not respond within the allocated 3000ms window."
              correlationId="ERR-REQ-98421"
              technicalDetails="HTTP 504 Gateway Timeout: Endpoint /api/v1/clinical/rules failed health check after 3 retries."
              onRetry={() => alert("Retrying...")}
            />
          </div>
        </section>

        {/* 9. Skeleton Loader */}
        <section className="space-y-4">
          <h2 className="font-heading font-semibold text-xl text-ink">9. Loading Skeletons</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SkeletonLoader variant="metric" />
            <SkeletonLoader variant="metric" />
            <SkeletonLoader variant="metric" />
          </div>
        </section>

        {/* Active Modals */}
        <ReasonDialog
          isOpen={showReasonDialog}
          title="Manual Triage Level Override"
          actionDescription="Overriding triage level from Routine to Urgent"
          onConfirm={(payload) => {
            setDialogResult(`ReasonDialog confirmed: Category "${payload.category}" — "${payload.reason}"`);
            setShowReasonDialog(false);
          }}
          onCancel={() => setShowReasonDialog(false)}
        />

        <StepUpDialog
          isOpen={showStepUpDialog}
          actionTitle="AI Kill Switch Engagement"
          onVerify={(code) => {
            setDialogResult(`StepUpDialog verified with code: ${code}`);
            setShowStepUpDialog(false);
          }}
          onCancel={() => setShowStepUpDialog(false)}
        />

        <ConfirmTypeToProceed
          isOpen={showConfirmType}
          title="Permanent Data Erasure (DPDP Request No. 812)"
          warningMessage="This action will cryptographically shred all identifiable records associated with patient MRN-8821. This operation CANNOT be undone."
          expectedWord="ERASE PATIENT 8821"
          confirmButtonText="Execute Cryptographic Shredding"
          onConfirm={() => {
            setDialogResult("ConfirmTypeToProceed executed successfully for ERASE PATIENT 8821");
            setShowConfirmType(false);
          }}
          onCancel={() => setShowConfirmType(false)}
        />
      </div>
    </PatientLayout>
  );
}

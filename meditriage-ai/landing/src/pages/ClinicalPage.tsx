import { ArrowLeft, Stethoscope, QrCode, PhoneCall, ArrowRight, Activity, CheckCircle2 } from 'lucide-react';

interface ClinicalPageProps {
  onBack: () => void;
  appUrl: string;
}

export default function ClinicalPage({ onBack, appUrl }: ClinicalPageProps) {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-16 animate-fade-in">
      {/* Back button & Stitch Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-(--border) bg-(--surface) text-(--ink) text-xs font-semibold hover:bg-(--primary-soft) hover:text-(--primary-dark) transition shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-(--primary-soft) text-(--primary-dark) text-xs font-semibold border border-(--primary)/20">
          <span className="w-2 h-2 rounded-full bg-(--primary) animate-pulse" />
          <span>Designed &amp; Architected with Stitch MCP</span>
        </div>
      </div>

      {/* Hero Header */}
      <div className="space-y-4 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-(--primary-soft) text-(--primary) text-xs font-mono font-bold tracking-wider uppercase">
          <Stethoscope className="w-4 h-4" />
          Clinical Platform Capabilities
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-(--ink) tracking-tight">
          The 4 Core Pillars of the MediTriage Clinical Suite
        </h1>

        <p className="text-base sm:text-lg text-(--muted) max-w-3xl leading-relaxed">
          From the moment a patient or caregiver notes an alarming symptom to the attending clinician&apos;s final bedside review, MediTriage AI maintains an unbroken chain of clinical evidence, medication masking alerts, and emergency responsiveness.
        </p>
      </div>

      {/* 4 Feature Deep-Dives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 1. Triage Intake */}
        <div className="p-8 rounded-3xl bg-(--surface) border border-(--border) shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-(--primary-soft) text-(--primary) flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-display font-bold text-(--ink)">
              1. Triage Intake Wizard (IntakeWizardV2)
            </h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              Step-by-step cognitive assessment tailored for older adults. Evaluates chief complaints, symptom severity, chronic conditions, and vital signs, with native voice input in Marathi, Hindi, and English.
            </p>
            <div className="space-y-1.5 text-xs text-(--ink) pt-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--selfcare)" />
                <span>Caregiver proxy support (informant tracking)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--selfcare)" />
                <span>Live NEWS2 aggregate physiological scoring</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--selfcare)" />
                <span>2D skin photo framing guide for wound review</span>
              </div>
            </div>
          </div>

          <a
            href={`${appUrl}/en/triage/intake`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-(--primary) text-white text-xs font-bold hover:brightness-110 transition shadow-sm"
          >
            Launch Triage Intake <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* 2. Emergency QR Card */}
        <div className="p-8 rounded-3xl bg-(--surface) border border-(--border) shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-(--primary-soft) text-(--primary) flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-display font-bold text-(--ink)">
              2. Paramedic Emergency QR Card
            </h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              An expiring, cryptographic pass carried by the senior citizen. Paramedics or emergency responders scan the code to instantly view blood group, severe allergies, chronic medications, and emergency contacts.
            </p>
            <div className="space-y-1.5 text-xs text-(--ink) pt-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--selfcare)" />
                <span>Zero login required for emergency responders</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--selfcare)" />
                <span>Strict PHI minimization (zero diagnostic notes)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--selfcare)" />
                <span>One-click printable and regenerable wallet format</span>
              </div>
            </div>
          </div>

          <a
            href={`${appUrl}/en/patient/emergency-card`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-(--primary) text-white text-xs font-bold hover:brightness-110 transition shadow-sm"
          >
            Manage Emergency QR Card <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* 3. Pune Emergency Directory */}
        <div className="p-8 rounded-3xl bg-(--surface) border border-(--border) shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-(--emergency)/10 text-(--emergency) flex items-center justify-center">
              <PhoneCall className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-display font-bold text-(--ink)">
              3. Pune Emergency Directory
            </h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              Real-time, verified emergency resources across Pune, Pimpri-Chinchwad, and Maharashtra. Pinned direct-dial 112 / 108 emergency bar with verified ICU bed centers and geriatric specialty facilities.
            </p>
            <div className="space-y-1.5 text-xs text-(--ink) pt-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--selfcare)" />
                <span>Pune Municipal Corporation (PMC) 108 Ambulance</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--selfcare)" />
                <span>Sassoon, KEM Hospital, Ruby Hall, Deenanath Mangeshkar</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--selfcare)" />
                <span>One-tap direct dial (tel:) and navigation map links</span>
              </div>
            </div>
          </div>

          <a
            href={`${appUrl}/en/resources`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-(--primary) text-white text-xs font-bold hover:brightness-110 transition shadow-sm"
          >
            Browse Pune Emergency Directory <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* 4. Clinician Priority Queue */}
        <div className="p-8 rounded-3xl bg-(--surface) border border-(--border) shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-(--primary-soft) text-(--primary) flex items-center justify-center">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-display font-bold text-(--ink)">
              4. Clinician Priority Queue &amp; Workspace
            </h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              High-density, calm operational workspace for doctors and triage nurses. Sorts acute emergencies, low-confidence algorithmic predictions, and symptom-masking polypharmacy interactions.
            </p>
            <div className="space-y-1.5 text-xs text-(--ink) pt-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--selfcare)" />
                <span>Single-key shortcuts (j, k, o, r, ?) for high-speed triage</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--selfcare)" />
                <span>Guarded emergency downgrade override safeguards</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--selfcare)" />
                <span>Integrated Clinical Copilot assistant drawer</span>
              </div>
            </div>
          </div>

          <a
            href={`${appUrl}/en/dashboard/clinician`}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-(--primary) text-white text-xs font-bold hover:brightness-110 transition shadow-sm"
          >
            Access Clinician Workspace <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

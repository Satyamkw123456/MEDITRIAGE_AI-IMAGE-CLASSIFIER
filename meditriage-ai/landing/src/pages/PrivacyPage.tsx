import { ShieldCheck, Lock, EyeOff, FileText, CheckCircle2, ArrowLeft, ExternalLink } from 'lucide-react';

interface PrivacyPageProps {
  onBack: () => void;
  appUrl: string;
}

export default function PrivacyPage({ onBack, appUrl }: PrivacyPageProps) {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-12 animate-fade-in">
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
          <ShieldCheck className="w-4 h-4" />
          Statutory Compliance • DPDP Act 2023
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-(--ink) tracking-tight">
          Digital Personal Data Protection (DPDP) Act 2023 Principles
        </h1>

        <p className="text-base sm:text-lg text-(--muted) max-w-3xl leading-relaxed">
          MediTriage AI is architected from the ground up to respect Indian patient privacy law, medical confidentiality, and statutory data minimization. Personal Health Information (PHI) is processed with ephemeral memory scrubbers, encrypted with AES-256 at rest, and strictly isolated from public model training weights.
        </p>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-(--muted) pt-2 border-t border-(--border)">
          <span>Jurisdiction: Republic of India</span>
          <span>•</span>
          <span>Version: DPDP-v2.4.1</span>
          <span>•</span>
          <span>Category: Significant Data Fiduciary (Clinical AI)</span>
        </div>
      </div>

      {/* 5 Core DPDP Pillars */}
      <div className="space-y-6">
        <h2 className="text-2xl font-display font-bold text-(--ink) flex items-center gap-2.5">
          <span>5 Core Architecture Pillars</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Pillar 1 */}
          <div className="p-6 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-(--primary-soft) text-(--primary) flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-(--ink)">1. Zero-Retention AI Gateway</h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              Patient symptom audio and text telemetry are processed strictly in volatile RAM. Memory vectors are scrubbed within &lt;1.8s of inference, guaranteeing zero disk writes of raw speech or identifiers.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-(--primary-soft) text-(--primary) flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-(--ink)">2. Explicit &amp; Granular Consent</h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              Aligned with Section 6 of the DPDP Act 2023. Clear, multilingual notices in English, Marathi (मराठी), and Hindi (हिंदी). Patients or nominated family caregivers can withdraw consent at any time with a single tap.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-(--primary-soft) text-(--primary) flex items-center justify-center">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-(--ink)">3. Cryptographic Shredding</h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              When a case is deleted or consent withdrawn, AES-256 envelope keys are destroyed, rendering any archived backup vectors permanently indecipherable.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="p-6 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-(--primary-soft) text-(--primary) flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-(--ink)">4. Access History Transparency</h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              Every clinician, administrative oversight action, or emergency break-glass view is immutably logged into a SHA-256 Merkle chain accessible directly by the patient in their dashboard.
            </p>
          </div>

          {/* Pillar 5 */}
          <div className="p-6 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-3 md:col-span-2 lg:col-span-2">
            <div className="w-10 h-10 rounded-xl bg-(--primary-soft) text-(--primary) flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-(--ink)">5. Zero Generative Model Training on PHI</h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              We contractually and cryptographically guarantee that identifiable patient records, conversations, vital signs, or wound imagery are NEVER used to train foundational AI or fine-tune public LLMs.
            </p>
          </div>
        </div>
      </div>

      {/* Patient & Caregiver Rights Checklist */}
      <div className="p-8 rounded-3xl bg-(--surface) border border-(--border) shadow-sm space-y-6">
        <h2 className="text-2xl font-display font-bold text-(--ink)">
          Patient &amp; Nominated Elder Caregiver Rights
        </h2>
        <p className="text-xs text-(--muted)">
          Under Section 9 of the DPDP Act 2023, senior citizens (वयस्कर नागरिक) and individuals requiring assistance can appoint family caregivers to manage their healthcare records with granular view-only or amendment scopes.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-(--bg) border border-(--border) space-y-1.5">
            <div className="font-bold text-(--ink) flex items-center justify-between">
              <span>Right to Information (माहिती मिळवण्याचा अधिकार)</span>
              <span className="text-[10px] font-mono text-(--primary)">Section 11(1)</span>
            </div>
            <p className="text-(--muted) leading-relaxed">
              Request a full summary of digital personal data processed by MediTriage AI, identities of clinicians who accessed it, and algorithmic triage outputs.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-(--bg) border border-(--border) space-y-1.5">
            <div className="font-bold text-(--ink) flex items-center justify-between">
              <span>Right to Correction &amp; Erasure (दुरुस्ती व हटवण्याचा अधिकार)</span>
              <span className="text-[10px] font-mono text-(--primary)">Section 12</span>
            </div>
            <p className="text-(--muted) leading-relaxed">
              Correct inaccurate vitals, update medication records, or trigger statutory data erasure with automated 30-day grace period restoration.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-(--bg) border border-(--border) space-y-1.5">
            <div className="font-bold text-(--ink) flex items-center justify-between">
              <span>Right to Nominate (नामनिर्देशन करण्याचा अधिकार)</span>
              <span className="text-[10px] font-mono text-(--primary)">Section 14</span>
            </div>
            <p className="text-(--muted) leading-relaxed">
              Designate trusted family members to exercise data rights in the event of death or severe medical incapacitation.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-(--bg) border border-(--border) space-y-1.5">
            <div className="font-bold text-(--ink) flex items-center justify-between">
              <span>Right of Grievance Redressal (तक्रार निवारणाचा अधिकार)</span>
              <span className="text-[10px] font-mono text-(--primary)">Section 13</span>
            </div>
            <p className="text-(--muted) leading-relaxed">
              Statutory 24-hour acknowledgement and 7-business-day dispute resolution overseen by the designated Data Protection Officer.
            </p>
          </div>
        </div>
      </div>

      {/* DPO Contact Card in Pune */}
      <div className="p-8 rounded-3xl bg-(--primary-soft) border border-(--primary)/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-(--ink)">
              Designated Data Protection Officer (DPO) • Pune, Maharashtra
            </h3>
            <p className="text-xs text-(--muted) mt-1">
              Statutory officer registered under the Digital Personal Data Protection Act 2023.
            </p>
          </div>
          <a
            href={`${appUrl}/en/triage/consent`}
            className="px-4 py-2 rounded-xl bg-(--primary) text-white text-xs font-bold hover:brightness-110 transition shadow-sm inline-flex items-center gap-1.5 self-start sm:self-center"
          >
            Manage Consent in App <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-(--primary)/15 text-xs">
          <div>
            <span className="font-bold text-(--ink) block">Legal &amp; DPO Lead</span>
            <span className="text-(--muted)">Adv. Ananya Deshpande, LL.M.</span>
            <span className="text-(--primary-dark) block font-mono mt-0.5">dpo@meditriage.ai</span>
          </div>

          <div>
            <span className="font-bold text-(--ink) block">Clinical Grievance Officer</span>
            <span className="text-(--muted)">Dr. Vikram Joshi, MD (Clinical Informatics)</span>
            <span className="text-(--primary-dark) block font-mono mt-0.5">grievance@meditriage.ai</span>
          </div>

          <div>
            <span className="font-bold text-(--ink) block">Registered Pune Office</span>
            <span className="text-(--muted)">Hinjawadi Infotech Park, Phase II, Pune, MH 411057</span>
            <span className="text-(--primary-dark) block font-mono mt-0.5">+91 (020) 6792-8800</span>
          </div>
        </div>
      </div>
    </div>
  );
}

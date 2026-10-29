import { Stethoscope, ShieldAlert, ArrowLeft, ExternalLink, Scale, CheckCircle2, PhoneCall } from 'lucide-react';

interface TermsPageProps {
  onBack: () => void;
  appUrl: string;
}

export default function TermsPage({ onBack, appUrl }: TermsPageProps) {
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-(--urgent)/10 text-(--urgent) text-xs font-mono font-bold tracking-wider uppercase">
          <Scale className="w-4 h-4" />
          Clinical Governance &bull; NMC &amp; CDSCO Guidelines Aligned
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-(--ink) tracking-tight">
          Clinician Supremacy Mandate &amp; Terms of Clinical Service
        </h1>

        <p className="text-base sm:text-lg text-(--muted) max-w-3xl leading-relaxed">
          MediTriage AI is a Software-as-a-Medical-Device (SaMD) Class II Clinical Decision Support (CDS) platform designed specifically for geriatric triage evaluation. Under Indian National Medical Commission (NMC) statutes and clinical protocols, the human clinician always maintains definitive supremacy.
        </p>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-(--muted) pt-2 border-t border-(--border)">
          <span>Effective: October 2026</span>
          <span>&bull;</span>
          <span>Jurisdiction: Pune, Maharashtra, India</span>
          <span>&bull;</span>
          <span>Governing Law: Indian Medical Council Act &amp; DPDP Act 2023</span>
        </div>
      </div>

      {/* Emergency Callout Card */}
      <div className="p-6 rounded-2xl bg-(--emergency)/10 border-2 border-(--emergency)/30 text-(--emergency) flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-(--emergency)/20 text-(--emergency) shrink-0">
            <PhoneCall className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight text-(--emergency)">
              Acute Medical Emergency Protocol
            </h3>
            <p className="text-xs text-(--emergency)/90 mt-0.5">
              MediTriage AI is NOT an emergency response hotline or ambulance dispatch service. If the patient has chest pain, sudden paralysis/slurred speech, or acute breathlessness, immediately dial 112 / 108.
            </p>
          </div>
        </div>
        <a
          href="tel:112"
          className="px-5 py-2.5 rounded-xl bg-(--emergency) text-white text-xs font-bold hover:brightness-110 transition shadow-sm whitespace-nowrap self-start sm:self-center"
        >
          Call Emergency 112
        </a>
      </div>

      {/* 4 Core Clinical Mandates */}
      <div className="space-y-6">
        <h2 className="text-2xl font-display font-bold text-(--ink)">
          4 Core Clinical Governance Mandates
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-(--selfcare)/10 text-(--selfcare) flex items-center justify-center">
              <Stethoscope className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-(--ink)">
              1. Clinician Supremacy &amp; Non-Delegable Duty
            </h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              Algorithmic triage outputs (routine, self-care, urgent, emergency) are preliminary decision-support classifications. An attending licensed medical practitioner must review, confirm, or override every recommendation prior to patient discharge or therapy prescription.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-(--primary-soft) text-(--primary) flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-(--ink)">
              2. Medication Shield &amp; Masking Disclosures
            </h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              In elderly patients, chronic medications (such as beta-blockers, antipyretics, or calcium-channel blockers) frequently mask tachycardia, fever, or hypotensive shock. The platform surfaces alerts to assist clinician scrutiny, but does not alter pharmaceutical orders.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-(--urgent)/10 text-(--urgent) flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-(--ink)">
              3. Caregiver &amp; Proxy Representation
            </h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              Caregivers acting as proxies for elderly relatives represent that they possess lawful authority or domestic authorization. Proxy actions are permanently tracked in the patient&apos;s statutory access history with the proxy&apos;s verified relationship and timestamp.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-(--primary-soft) text-(--primary) flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-(--ink)">
              4. Evidence Act Section 65B Audit Preservation
            </h3>
            <p className="text-xs text-(--muted) leading-relaxed">
              All clinical revisions, override justifications, and emergency downgrade double-confirmations are cryptographically signed with HMAC-SHA256 to ensure admissibility and tamper-proof compliance under Indian Evidence Act Section 65B.
            </p>
          </div>
        </div>
      </div>

      {/* Dispute Resolution & Jurisdiction */}
      <div className="p-8 rounded-3xl bg-(--surface) border border-(--border) shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-(--ink)">
          Governing Law &amp; Exclusive Jurisdiction
        </h3>
        <p className="text-xs text-(--muted) leading-relaxed">
          These terms and all triage interactions are governed by the laws of the Republic of India. The courts of competent jurisdiction located in Pune, Maharashtra, India shall have exclusive jurisdiction over any claims or disputes arising under these terms.
        </p>
        <div className="pt-2">
          <a
            href={`${appUrl}/en/login`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-(--primary) text-white text-xs font-bold hover:brightness-110 transition shadow-sm"
          >
            Access Clinical Workspace <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

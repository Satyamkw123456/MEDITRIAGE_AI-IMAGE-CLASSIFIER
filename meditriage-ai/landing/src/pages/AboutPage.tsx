import { ArrowLeft, Stethoscope, HeartPulse, ShieldCheck, Users, ExternalLink } from 'lucide-react';

interface AboutPageProps {
  onBack: () => void;
  appUrl: string;
}

export default function AboutPage({ onBack, appUrl }: AboutPageProps) {
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
          <HeartPulse className="w-4 h-4" />
          Clinical Mission &bull; Geriatric Intelligence
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-(--ink) tracking-tight">
          Bridging the Geriatric Care Gap with Intelligent, Dignified Decision Support
        </h1>

        <p className="text-base sm:text-lg text-(--muted) max-w-3xl leading-relaxed">
          Founded in Pune, Maharashtra, MediTriage AI exists to solve one of modern healthcare&apos;s most critical vulnerabilities: atypical presentations and medication-masking in older patients during triage emergencies.
        </p>
      </div>

      {/* The Challenge in India */}
      <div className="p-8 sm:p-10 rounded-3xl bg-(--surface) border border-(--border) shadow-sm space-y-4">
        <h2 className="text-xl sm:text-2xl font-display font-bold text-(--ink)">
          The Demographic Reality: 340 Million Elderly by 2050
        </h2>
        <p className="text-xs sm:text-sm text-(--muted) leading-relaxed">
          In India, senior citizens frequently experience acute medical emergencies without textbook symptoms. A silent myocardial infarction may present only as mild confusion or fatigue; severe bacterial sepsis may present with hypothermia rather than fever; and essential beta-blockers prevent the elevated heart rate that clinicians traditionally rely on to detect internal bleeding.
        </p>
        <p className="text-xs sm:text-sm text-(--muted) leading-relaxed">
          MediTriage AI integrates age-stratified physiological scoring (NEWS2), medication-masking intelligence (Medication Shield), and Devanagari voice interaction to ensure that vulnerable elders receive the urgency tier they clinically require.
        </p>
      </div>

      {/* 3 Core Philosophical Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-(--selfcare)/10 text-(--selfcare) flex items-center justify-center">
            <Stethoscope className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-(--ink)">
            Clinical Honesty Over Automation
          </h3>
          <p className="text-xs text-(--muted) leading-relaxed">
            We never replace human physicians or promise automated diagnosis. Our algorithms augment doctors with structured evidence, differential confidence intervals, and explainable consensus votes.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-(--primary-soft) text-(--primary) flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-(--ink)">
            Cognitive Accessibility (Elder Mode)
          </h3>
          <p className="text-xs text-(--muted) leading-relaxed">
            Technology must respect aging eyes, tremors, and cognitive changes. Our interfaces feature 20px typography, 56px touch targets, zero deceptive dark patterns, and native Marathi and Hindi Devanagari support.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-(--urgent)/10 text-(--urgent) flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-(--ink)">
            Sovereign Patient Privacy
          </h3>
          <p className="text-xs text-(--muted) leading-relaxed">
            Built under India&apos;s DPDP Act 2023 with ephemeral edge RAM processing, zero disk writes of raw speech, and cryptographic forward secrecy. Patient health information is never ingested into public model weights.
          </p>
        </div>
      </div>

      {/* Clinical Leadership Team */}
      <div className="space-y-6">
        <h2 className="text-2xl font-display font-bold text-(--ink)">
          Clinical &amp; Informatics Leadership
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-2">
            <div className="w-12 h-12 rounded-xl bg-(--primary-soft) text-(--primary) font-bold text-sm flex items-center justify-center font-mono">
              VJ
            </div>
            <h4 className="font-bold text-sm text-(--ink)">Dr. Vikram Joshi, MD</h4>
            <span className="text-[11px] text-(--primary) font-medium block">Chief Medical Officer</span>
            <p className="text-[11px] text-(--muted) leading-relaxed">
              Former Professor of Geriatric Medicine, AFMC Pune. 22 years clinical emergency experience.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-2">
            <div className="w-12 h-12 rounded-xl bg-(--primary-soft) text-(--primary) font-bold text-sm flex items-center justify-center font-mono">
              AD
            </div>
            <h4 className="font-bold text-sm text-(--ink)">Adv. Ananya Deshpande</h4>
            <span className="text-[11px] text-(--primary) font-medium block">Head of Governance &amp; DPO</span>
            <p className="text-[11px] text-(--muted) leading-relaxed">
              LL.M. in Health Cyber Law. National advisor on DPDP Act 2023 compliance frameworks.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-2">
            <div className="w-12 h-12 rounded-xl bg-(--primary-soft) text-(--primary) font-bold text-sm flex items-center justify-center font-mono">
              RN
            </div>
            <h4 className="font-bold text-sm text-(--ink)">Dr. Radhika Nair, PhD</h4>
            <span className="text-[11px] text-(--primary) font-medium block">Lead AI Safety Researcher</span>
            <p className="text-[11px] text-(--muted) leading-relaxed">
              Specialist in clinical NLP and multi-agent consensus validation across Indian languages.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-(--surface) border border-(--border) shadow-sm space-y-2">
            <div className="w-12 h-12 rounded-xl bg-(--primary-soft) text-(--primary) font-bold text-sm flex items-center justify-center font-mono">
              RK
            </div>
            <h4 className="font-bold text-sm text-(--ink)">Rajesh Kulkarni</h4>
            <span className="text-[11px] text-(--primary) font-medium block">Chief Technology Officer</span>
            <p className="text-[11px] text-(--muted) leading-relaxed">
              Ex-Lead Systems Architect, specialized in zero-trust healthcare infrastructure and offline-first edge compute.
            </p>
          </div>
        </div>
      </div>

      {/* Pune Health Network Collaborations */}
      <div className="p-8 rounded-3xl bg-(--primary-soft) border border-(--primary)/20 space-y-4">
        <h3 className="text-lg font-bold text-(--ink)">
          Rooted in Pune&apos;s Medical &amp; Technology Ecosystem
        </h3>
        <p className="text-xs text-(--muted) leading-relaxed">
          MediTriage AI coordinates closely with local emergency providers, including the Pune Municipal Corporation (PMC) 108 Emergency Ambulance network, Sassoon General Hospital, KEM Hospital, and leading private geriatric wellness clinics across Maharashtra.
        </p>

        <div className="pt-2 flex flex-wrap gap-3">
          <a
            href={`${appUrl}/en/resources`}
            className="px-4 py-2 rounded-xl bg-(--primary) text-white text-xs font-bold hover:brightness-110 transition shadow-sm inline-flex items-center gap-1.5"
          >
            Explore Pune Emergency Directory <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

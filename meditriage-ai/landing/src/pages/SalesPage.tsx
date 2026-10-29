import { useState, type FormEvent } from 'react';
import { ArrowLeft, Check, ShieldCheck, Building2, ExternalLink } from 'lucide-react';

interface SalesPageProps {
  onBack: () => void;
  appUrl: string;
}

export default function SalesPage({ onBack, appUrl }: SalesPageProps) {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    institution: '',
    role: 'Clinical Director',
    facilityType: 'Hospital',
    bedCount: '50-200 beds',
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-16 animate-fade-in">
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
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-(--primary-soft) text-(--primary) text-xs font-mono font-bold tracking-wider uppercase">
          <Building2 className="w-4 h-4" />
          Enterprise Healthcare Solutions
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-(--ink) tracking-tight">
          Clinical Decision Support for Geriatric Care Networks
        </h1>

        <p className="text-base sm:text-lg text-(--muted) leading-relaxed">
          Deploy age-attuned triage intelligence, medication-masking shields, and emergency QR cards across outpatient clinics, nursing home networks, and hospital emergency departments.
        </p>

        <div className="pt-2 flex justify-center">
          <a
            href={`${appUrl}/en/triage/intake`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-(--primary-soft) text-(--primary-dark) text-xs font-bold hover:brightness-105 transition border border-(--primary)/20"
          >
            <span>Explore Clinical Intake Sandbox</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 3 Pricing Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Tier 1 */}
        <div className="p-8 rounded-3xl bg-(--surface) border border-(--border) shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-(--muted)">
              Community Clinic
            </span>
            <div className="space-y-1">
              <span className="text-3xl font-display font-bold text-(--ink)">₹12,000</span>
              <span className="text-xs text-(--muted) block">/ month per facility</span>
            </div>
            <p className="text-xs text-(--muted) leading-relaxed">
              Ideal for independent geriatric clinics, primary care centers, and outpatient elder consultations.
            </p>

            <div className="pt-4 border-t border-(--border) space-y-2.5 text-xs text-(--ink)">
              {[
                'Up to 500 patient intakes / month',
                'Elder Mode (20px type, 56px targets)',
                'Marathi, Hindi & English native i18n',
                'Emergency QR Card Generator',
                'Pune Emergency Directory access',
                'Standard 99.5% uptime SLA',
              ].map((feat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-(--selfcare) shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <a
            href="#contact"
            className="w-full py-2.5 rounded-xl border border-(--border) text-center text-xs font-bold text-(--ink) hover:bg-(--primary-soft) hover:text-(--primary-dark) transition"
          >
            Deploy Clinic Tier
          </a>
        </div>

        {/* Tier 2: Highlighted */}
        <div className="p-8 rounded-3xl bg-(--surface) border-2 border-(--primary) shadow-md flex flex-col justify-between space-y-6 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-(--primary) text-white text-[11px] font-bold tracking-wide uppercase shadow-sm">
            Most Popular in Pune
          </div>

          <div className="space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-(--primary)">
              Hospital Emergency
            </span>
            <div className="space-y-1">
              <span className="text-3xl font-display font-bold text-(--ink)">₹48,000</span>
              <span className="text-xs text-(--muted) block">/ month per emergency department</span>
            </div>
            <p className="text-xs text-(--muted) leading-relaxed">
              High-throughput EDs and multispeciality hospitals managing acute elderly admissions and frailty backlogs.
            </p>

            <div className="pt-4 border-t border-(--border) space-y-2.5 text-xs text-(--ink)">
              {[
                'Unlimited patient intakes & queue triage',
                'Clinician Priority Queue with NEWS2',
                'Medication Shield symptom-masking alerts',
                '2D Skin & wound framing guidance',
                'Clinician Copilot drawer & chat assist',
                'DPDP Act 2023 forensic export tool',
                '24/7 dedicated clinical hotline',
              ].map((feat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-(--primary) shrink-0" />
                  <span className="font-medium">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <a
            href="#contact"
            className="w-full py-2.5 rounded-xl bg-(--primary) text-center text-xs font-bold text-white hover:brightness-110 transition shadow-sm"
          >
            Request ED Pilot (30 Days)
          </a>
        </div>

        {/* Tier 3 */}
        <div className="p-8 rounded-3xl bg-(--surface) border border-(--border) shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-(--muted)">
              Health System &amp; State Network
            </span>
            <div className="space-y-1">
              <span className="text-3xl font-display font-bold text-(--ink)">Custom</span>
              <span className="text-xs text-(--muted) block">Multi-hospital deployment</span>
            </div>
            <p className="text-xs text-(--muted) leading-relaxed">
              For hospital conglomerates, municipal health trusts, and national telehealth networks requiring dedicated VPC infrastructure.
            </p>

            <div className="pt-4 border-t border-(--border) space-y-2.5 text-xs text-(--ink)">
              {[
                'Multi-tenant isolated on-premise VPC',
                'ABDM M1/M2/M3 & HL7 / FHIR connector',
                'Custom consensus & clinical rule tuning',
                'Dual-control administrative break-glass',
                'On-site physician & nurse CME workshops',
                'Dedicated Technical Account Manager',
              ].map((feat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-(--selfcare) shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <a
            href="#contact"
            className="w-full py-2.5 rounded-xl border border-(--border) text-center text-xs font-bold text-(--ink) hover:bg-(--primary-soft) hover:text-(--primary-dark) transition"
          >
            Contact Enterprise Sales
          </a>
        </div>
      </div>

      {/* Contact Sales Form */}
      <div id="contact" className="p-8 sm:p-12 rounded-3xl bg-(--surface) border border-(--border) shadow-sm max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-display font-bold text-(--ink)">
            Schedule a Live Clinical Demonstration
          </h2>
          <p className="text-xs text-(--muted)">
            Speak directly with our clinical informatics team in Pune to explore trial deployment and EMR integration.
          </p>
        </div>

        {submitted ? (
          <div className="p-8 rounded-2xl bg-(--selfcare)/10 border border-(--selfcare)/30 text-center space-y-2">
            <ShieldCheck className="w-10 h-10 text-(--selfcare) mx-auto" />
            <h3 className="text-base font-bold text-(--ink)">Demo Request Received</h3>
            <p className="text-xs text-(--muted)">
              Our clinical informatics team will contact you within 4 business hours to schedule a demonstration tailored to your hospital volume.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-(--ink) block mb-1">Your Full Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Dr. Siddharth Verma"
                  className="w-full p-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--ink) focus:outline-none focus:ring-2 focus:ring-(--primary)"
                />
              </div>

              <div>
                <label className="font-bold text-(--ink) block mb-1">Hospital / Clinic Name</label>
                <input
                  required
                  type="text"
                  value={formData.institution}
                  onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                  placeholder="Ruby Hall Clinic, Pune"
                  className="w-full p-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--ink) focus:outline-none focus:ring-2 focus:ring-(--primary)"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-(--ink) block mb-1">Institutional Email</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="s.verma@rubyhall.com"
                  className="w-full p-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--ink) focus:outline-none focus:ring-2 focus:ring-(--primary)"
                />
              </div>

              <div>
                <label className="font-bold text-(--ink) block mb-1">Direct Phone</label>
                <input
                  required
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98220 12345"
                  className="w-full p-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--ink) focus:outline-none focus:ring-2 focus:ring-(--primary)"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-(--ink) block mb-1">Your Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--ink) focus:outline-none focus:ring-2 focus:ring-(--primary)"
                >
                  <option>Medical Superintendent</option>
                  <option>Head of Emergency Medicine</option>
                  <option>Chief Medical Officer</option>
                  <option>Hospital Administrator / CEO</option>
                  <option>Geriatric Department Lead</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-(--ink) block mb-1">Facility Size / Bed Capacity</label>
                <select
                  value={formData.bedCount}
                  onChange={(e) => setFormData({ ...formData, bedCount: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-(--border) bg-(--bg) text-(--ink) focus:outline-none focus:ring-2 focus:ring-(--primary)"
                >
                  <option>&lt; 50 beds (Day Clinic / Nursing Home)</option>
                  <option>50 - 200 beds (Community Hospital)</option>
                  <option>200 - 500 beds (Tertiary Care Center)</option>
                  <option>&gt; 500 beds (Academic Medical Center / Group)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-(--primary) text-white font-bold text-xs hover:brightness-110 transition shadow-sm mt-4"
            >
              Request Institutional Deployment
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Search, ArrowLeft } from 'lucide-react';

interface FAQsPageProps {
  onBack: () => void;
  appUrl: string;
}

interface FAQItem {
  id: string;
  category: 'patients' | 'caregivers' | 'clinicians' | 'privacy';
  question: string;
  answer: string;
}

const FAQS_DATA: FAQItem[] = [
  {
    id: 'faq-1',
    category: 'patients',
    question: 'What is MediTriage AI and how does it help me?',
    answer: 'MediTriage AI is an intelligent clinical decision-support platform designed specifically for older adults. When you experience symptoms, it asks targeted, age-aware questions and calculates how quickly you should see a doctor (Self-Care, Routine, Urgent, or Emergency), taking into account your regular medications and medical conditions.',
  },
  {
    id: 'faq-2',
    category: 'patients',
    question: 'What do the four triage colors mean?',
    answer: 'Emergency (Red): Immediate critical condition — call 112 or go to the nearest emergency room. Urgent (Amber): Needs prompt medical evaluation within 2 to 4 hours. Routine (Blue): Standard non-urgent outpatient consultation. Self-Care (Green): Mild, benign symptoms manageable at home with close monitoring.',
  },
  {
    id: 'faq-3',
    category: 'patients',
    question: 'What is Elder Mode and how does it work?',
    answer: 'Elder Mode is an accessibility framework built for senior citizens. It increases base typography to 20px, expands all touch targets to at least 56px, enforces strict 7:1 contrast ratios, removes distracting animations, and simplifies language in English, Marathi (मराठी), and Hindi (हिंदी).',
  },
  {
    id: 'faq-4',
    category: 'patients',
    question: 'What is the Emergency QR Card?',
    answer: 'Your Emergency QR Card is a secure, time-expiring pass. In an accident or sudden acute event, emergency paramedics or doctors can scan the QR code to instantly see essential life-saving data (allergies, emergency contacts, chronic conditions, blood group) without requiring an account login or leaking sensitive history.',
  },
  {
    id: 'faq-5',
    category: 'caregivers',
    question: 'How can family caregivers assist with triage intake?',
    answer: 'Under the caregiver proxy flow, a daughter, son, or designated guardian can submit an intake on behalf of an elderly relative. The platform automatically marks the record with informant_type="caregiver" so the examining physician knows who provided the clinical history.',
  },
  {
    id: 'faq-6',
    category: 'caregivers',
    question: 'Can I manage permissions or revoke caregiver access?',
    answer: 'Yes. Patients maintain full legal sovereignty. A caregiver can be assigned View-Only or Full Amendment permissions, and the patient can revoke access at any time through the Caregiver Manager.',
  },
  {
    id: 'faq-7',
    category: 'clinicians',
    question: 'How does the Clinician Priority Queue sort cases?',
    answer: 'The queue sorts incoming cases by clinical risk: acute Red-Flag emergencies come first, followed by NEWS2 aggregate physiological instability, followed by low-confidence model predictions requiring human validation, and finally routine consults.',
  },
  {
    id: 'faq-8',
    category: 'clinicians',
    question: 'What is the Medication Shield?',
    answer: 'Older patients often take chronic prescription drugs that mask illness: beta-blockers prevent reflex tachycardia during hemorrhage or sepsis, antipyretics hide severe fevers, and calcium-channel blockers blunt hypertension. The Medication Shield automatically alerts clinicians to these masking interactions.',
  },
  {
    id: 'faq-9',
    category: 'clinicians',
    question: 'Can a clinician override an algorithmic triage rating?',
    answer: 'Yes. Clinician supremacy is absolute. If a clinician downgrades an emergency triage level, a guarded double-confirmation dialog requires a detailed written justification (&ge; 20 characters), which is then cryptographically logged into the case audit trail.',
  },
  {
    id: 'faq-10',
    category: 'privacy',
    question: 'Is my health data safe under India\'s DPDP Act 2023?',
    answer: 'Absolutely. MediTriage AI adheres strictly to the Digital Personal Data Protection Act 2023. Audio and symptom inputs are processed in volatile RAM with zero disk writes, encrypted with AES-256, and never used to train public generative AI models.',
  },
];

export default function FAQsPage({ onBack, appUrl }: FAQsPageProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | 'patients' | 'caregivers' | 'clinicians' | 'privacy'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>('faq-1');

  const filteredFaqs = FAQS_DATA.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesQuery = item.question.toLowerCase().includes(searchQuery.toLowerCase()) || item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

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
          <HelpCircle className="w-4 h-4" />
          Knowledge &amp; Support Hub
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-(--ink) tracking-tight">
          Frequently Asked Questions
        </h1>

        <p className="text-base sm:text-lg text-(--muted) max-w-3xl leading-relaxed">
          Everything you need to know about MediTriage AI, geriatric triage protocols, caregiver proxy rights, clinician review workflows, and data safety.
        </p>

        {/* Search Input */}
        <div className="pt-2 max-w-xl">
          <div className="relative">
            <Search className="w-4 h-4 text-(--muted) absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by symptom, triage tier, elder mode, or law..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-(--border) bg-(--surface) text-xs text-(--ink) focus:outline-none focus:ring-2 focus:ring-(--primary) shadow-sm"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {[
            { id: 'all', label: 'All FAQs' },
            { id: 'patients', label: 'For Patients & Elders' },
            { id: 'caregivers', label: 'For Family Caregivers' },
            { id: 'clinicians', label: 'For Clinicians & Hospitals' },
            { id: 'privacy', label: 'DPDP & Privacy' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                activeCategory === cat.id
                  ? 'bg-(--primary) text-white shadow-sm'
                  : 'bg-(--surface) border border-(--border) text-(--muted) hover:text-(--ink)'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accordion FAQ List */}
      <div className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-(--surface) border border-(--border) text-(--muted)">
            <p className="font-bold text-(--ink)">No questions match your query.</p>
            <p className="text-xs mt-1">Try another keyword or select All FAQs.</p>
          </div>
        ) : (
          filteredFaqs.map((faq) => {
            const isExpanded = expandedId === faq.id;
            return (
              <div
                key={faq.id}
                className="rounded-2xl border border-(--border) bg-(--surface) overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-(--primary-soft)/20 transition"
                  aria-expanded={isExpanded}
                >
                  <span className="font-bold text-sm text-(--ink) leading-snug">
                    {faq.question}
                  </span>
                  <div className="p-1 rounded-lg bg-(--primary-soft) text-(--primary) shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-(--muted) leading-relaxed border-t border-(--border)/50">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Support Card */}
      <div className="p-8 rounded-3xl bg-(--primary-soft) border border-(--primary)/20 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold text-(--ink)">
            Have a question not listed here?
          </h3>
          <p className="text-xs text-(--muted) mt-1 max-w-xl">
            Our built-in AI Guide answers 40+ clinical, legal, and operational topics completely offline in English, Hindi, and Marathi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`${appUrl}/en/resources`}
            className="px-4 py-2 rounded-xl border border-(--primary) text-(--primary) bg-white text-xs font-bold hover:bg-(--primary) hover:text-white transition shadow-sm"
          >
            Pune Directory
          </a>
          <a
            href={`${appUrl}/en/triage/intake`}
            className="px-4 py-2 rounded-xl bg-(--primary) text-white text-xs font-bold hover:brightness-110 transition shadow-sm"
          >
            Launch Triage Intake
          </a>
        </div>
      </div>
    </div>
  );
}

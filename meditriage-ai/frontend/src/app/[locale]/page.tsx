import Link from 'next/link';
import { ShieldCheck, HeartPulse, Stethoscope, ArrowRight, UserCheck } from 'lucide-react';

export default function HomePage({params: {locale}}: {params: {locale: string}}) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Alert banner for medical disclaimer */}
      <div className="mb-8 p-4 rounded-xl border border-amber-300 bg-amber-50/80 text-amber-900 shadow-sm flex items-start space-x-3">
        <span className="text-xl">⚠️</span>
        <div className="text-sm">
          <strong className="font-semibold block mb-0.5">Clinical Safety Notice — Decision Support Only</strong>
          This system provides AI-assisted clinical decision support. It does not replace professional emergency care or clinician judgment. A human clinician always makes the final decision under India&apos;s DPDP Act, 2023 principles.
        </div>
      </div>

      {/* Hero section */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-4">
          <span>👵 Geriatric-Focused Decision Support</span>
          <span>•</span>
          <span>DPDP 2023 Compliant</span>
          <span>•</span>
          <span>JWT + Role-Based Access Control</span>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
          MediTriage <span className="text-teal-600">AI</span>
        </h1>
        <p className="mt-4 text-lg text-slate-600 leading-relaxed">
          AI-assisted emergency triage tailored for elderly patients, accounting for atypical symptom presentations, vital-masking medications, and multi-comorbidity overload.
        </p>

        {/* Hero CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={`/${locale}/login`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition text-sm"
          >
            <UserCheck className="w-4 h-4" />
            <span>Sign In to Clinical Portal</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/${locale}/register`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold border border-slate-300 rounded-xl shadow-sm hover:shadow transition text-sm"
          >
            <span>Create New Account</span>
          </Link>
        </div>
      </div>

      {/* Role Personas Quick Cards */}
      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold text-lg mb-4">
            <HeartPulse className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Patient &amp; Caregiver Portal</h3>
          <p className="text-xs text-slate-500 mb-4">
            High-contrast, accessible symptom reporting with digital consent logging under DPDP Act 2023.
          </p>
          <Link
            href={`/${locale}/dashboard/patient`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
          >
            View Patient View &rarr;
          </Link>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-lg mb-4">
            <Stethoscope className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Attending Clinician Desk</h3>
          <p className="text-xs text-slate-500 mb-4">
            Physician priority queue, automated deterministic red-flag alerts, and differential diagnosis review.
          </p>
          <Link
            href={`/${locale}/dashboard/clinician`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            View Clinician Queue &rarr;
          </Link>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center font-bold text-lg mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">System Administrator</h3>
          <p className="text-xs text-slate-500 mb-4">
            Audit log monitoring, clinical quality compliance gating, and user access oversight.
          </p>
          <Link
            href={`/${locale}/dashboard/admin`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700"
          >
            View Admin Console &rarr;
          </Link>
        </div>
      </div>

      {/* System Readiness Box */}
      <div className="mt-12 p-6 rounded-2xl bg-white border border-slate-200 text-center">
        <div className="text-xs uppercase tracking-wider text-teal-600 font-semibold mb-1">
          System Verification Status
        </div>
        <div className="text-sm font-medium text-slate-800">
          Core Database Schema &amp; Role-Based Access Control (RBAC) Fully Verified with Automated Test Suites.
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Next Phase: Prompt 4 (Consent &amp; Medical Disclaimer Screen) &amp; Prompt 5 (Geriatric Intake Form).
        </div>
      </div>
    </div>
  );
}

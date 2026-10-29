'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  UserPlus, 
  AlertCircle, 
  ArrowRight, 
  HeartPulse, 
  Users, 
  Info, 
  Check, 
  X, 
  Eye, 
  EyeOff,
  Stethoscope,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';

type PublicRole = 'patient' | 'caregiver';

const inputClass =
  'w-full min-h-[48px] px-3.5 rounded-lg border border-border-control bg-surface text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition';

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const locale = useLocale();
  const [role, setRole] = useState<PublicRole>('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Patient profile (optional)
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [allergies, setAllergies] = useState('');

  const [error, setError] = useState<string | null>(null);

  // Live password validation checklist
  const passwordCriteria = useMemo(() => {
    const hasMinLength = password.length >= 10;
    
    // Character classes
    let classesCount = 0;
    if (/[a-z]/.test(password)) classesCount++;
    if (/[A-Z]/.test(password)) classesCount++;
    if (/[0-9]/.test(password)) classesCount++;
    if (/[^a-zA-Z0-9]/.test(password)) classesCount++;

    const hasMix = classesCount >= 3;
    const notEmailPart = !email || !email.includes('@') || !password.toLowerCase().includes(email.split('@')[0].toLowerCase());
    const isReasonablyComplex = password.length >= 10 && hasMix;

    return {
      hasMinLength,
      hasMix,
      notEmailPart,
      isValid: hasMinLength && hasMix && notEmailPart,
    };
  }, [password, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agreedToTerms) {
      setError('Please acknowledge the terms of service and DPDP consent to continue.');
      return;
    }

    if (!passwordCriteria.isValid) {
      setError('Please choose a password meeting all clinical security standards.');
      return;
    }

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        ...(role === 'patient' && {
          age: age ? parseInt(age, 10) : undefined,
          sex: sex || undefined,
          medical_history: medicalHistory.trim() || undefined,
          allergies: allergies.trim() || undefined,
        }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please check your inputs.';
      setError(msg);
    }
  };

  return (
    <div className="min-h-[90vh] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-bg">
      <div className="w-full max-w-5xl bg-surface rounded-panel border border-line shadow-card overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Trust / Guidance Panel */}
        <div className="hidden lg:flex lg:col-span-5 bg-bg-tint border-r border-line p-8 flex-col justify-between">
          <div>
            <Link href={`/${locale}`} className="inline-block mb-8">
              <img 
                src="/logo.svg" 
                alt="MediTriage AI" 
                className="h-10 w-auto object-contain hover:opacity-95 transition-opacity" 
              />
            </Link>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-soft text-primary border border-line">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Patient &amp; Caregiver Registration</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-ink font-display leading-tight">
                Empowering older adults with safer, smarter triage.
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                MediTriage AI enables elderly patients and their family caregivers to record symptoms, monitor baselines, and obtain rapid clinical triage escalation.
              </p>
            </div>
          </div>

          <div className="space-y-3.5 pt-8 border-t border-line">
            <div className="flex items-start gap-2.5 text-xs text-ink/90">
              <CheckCircle2 className="w-4 h-4 text-selfcare shrink-0 mt-0.5" />
              <span><strong>DPDP 2023 Compliant:</strong> Granular consent &amp; data deletion rights.</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-ink/90">
              <CheckCircle2 className="w-4 h-4 text-selfcare shrink-0 mt-0.5" />
              <span><strong>Caregiver Delegation:</strong> Trusted family proxy management.</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-ink/90">
              <CheckCircle2 className="w-4 h-4 text-selfcare shrink-0 mt-0.5" />
              <span><strong>Offline QR Card:</strong> Immediate first-responder access in emergencies.</span>
            </div>
          </div>
        </div>

        {/* Right Form Container */}
        <div className="col-span-1 lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="lg:hidden">
                <Link href={`/${locale}`}>
                  <img src="/logo.svg" alt="MediTriage AI" className="h-9 w-auto object-contain" />
                </Link>
              </div>
              <div className="ml-auto">
                <LanguageSwitcher />
              </div>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-ink tracking-tight">Create your account</h1>
              <p className="text-sm text-muted mt-1">
                Select your primary role to customize your health management portal.
              </p>
            </div>

            {error && (
              <div 
                role="alert" 
                aria-live="polite"
                className="mb-5 p-3.5 bg-emergency-soft border border-emergency rounded-xl flex items-start gap-2.5 text-emergency text-sm"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Role Selection Tiles */}
            <fieldset className="mb-6">
              <legend className="block text-xs font-semibold text-ink uppercase tracking-wider mb-2.5">
                Select your account role <span className="text-emergency">*</span>
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRole('patient')}
                  aria-pressed={role === 'patient'}
                  className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between min-h-[96px] ${
                    role === 'patient'
                      ? 'border-primary bg-primary-soft text-primary ring-2 ring-primary/20 shadow-xs'
                      : 'border-line bg-surface text-muted hover:border-border-control'
                  }`}
                >
                  <HeartPulse className="w-5 h-5 text-primary mb-2" />
                  <div>
                    <span className="block text-xs font-bold text-ink">Patient / Elder</span>
                    <span className="block text-[11px] text-muted mt-0.5">Self-managed triage &amp; baselines</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('caregiver')}
                  aria-pressed={role === 'caregiver'}
                  className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between min-h-[96px] ${
                    role === 'caregiver'
                      ? 'border-primary bg-primary-soft text-primary ring-2 ring-primary/20 shadow-xs'
                      : 'border-line bg-surface text-muted hover:border-border-control'
                  }`}
                >
                  <Users className="w-5 h-5 text-routine mb-2" />
                  <div>
                    <span className="block text-xs font-bold text-ink">Family Caregiver</span>
                    <span className="block text-[11px] text-muted mt-0.5">Proxy triage for elderly relative</span>
                  </div>
                </button>

                <div
                  className="p-3.5 rounded-xl border border-line bg-bg text-left flex flex-col justify-between min-h-[96px] opacity-75 cursor-not-allowed"
                  title="Clinician accounts require hospital administrator provisioning"
                >
                  <Stethoscope className="w-5 h-5 text-muted mb-2" />
                  <div>
                    <span className="block text-xs font-bold text-muted">Clinician</span>
                    <span className="block text-[11px] text-muted mt-0.5">Hospital verification required</span>
                  </div>
                </div>
              </div>
            </fieldset>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-semibold text-ink mb-1.5">
                    Full Name <span className="text-emergency">*</span>
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    minLength={2}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kamla Devi"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="reg-email" className="block text-xs font-semibold text-ink mb-1.5">
                    Email Address <span className="text-emergency">*</span>
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-xs font-semibold text-ink mb-1.5">
                  Password <span className="text-emergency">*</span>
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={10}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`${inputClass} pr-10`}
                    aria-describedby="password-rules-list"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Live Password Checklist */}
                <div id="password-rules-list" className="mt-2.5 p-3 rounded-lg bg-bg border border-line space-y-1.5 text-xs">
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.hasMinLength ? 'text-selfcare font-medium' : 'text-muted'}`}>
                    {passwordCriteria.hasMinLength ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                    <span>At least 10 characters in length</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.hasMix ? 'text-selfcare font-medium' : 'text-muted'}`}>
                    {passwordCriteria.hasMix ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                    <span>Characters from at least 3 categories (lowercase, uppercase, numbers, symbols)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.notEmailPart ? 'text-selfcare font-medium' : 'text-muted'}`}>
                    {passwordCriteria.notEmailPart ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                    <span>Does not contain parts of your email address</span>
                  </div>
                </div>
              </div>

              {/* Patient Profile Demographics (Optional) */}
              {role === 'patient' && (
                <div className="space-y-4 rounded-xl border border-line bg-bg-tint/40 p-4 mt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-ink">
                      Health Profile <span className="font-normal text-muted">(Optional — can be added later)</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-age" className="block text-xs font-semibold text-ink mb-1">Age (Years)</label>
                      <input 
                        id="reg-age" 
                        type="number" 
                        min={0} 
                        max={130} 
                        value={age} 
                        onChange={(e) => setAge(e.target.value)} 
                        className={inputClass} 
                        placeholder="e.g. 74"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-sex" className="block text-xs font-semibold text-ink mb-1">Sex</label>
                      <select 
                        id="reg-sex" 
                        value={sex} 
                        onChange={(e) => setSex(e.target.value)} 
                        className={inputClass}
                      >
                        <option value="">Prefer not to say</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="reg-history" className="block text-xs font-semibold text-ink mb-1">Known Conditions &amp; Daily Medications</label>
                    <textarea 
                      id="reg-history" 
                      rows={2} 
                      value={medicalHistory} 
                      onChange={(e) => setMedicalHistory(e.target.value)}
                      placeholder="e.g. Hypertension, Metoprolol 50mg, Diabetes Type 2" 
                      className={`${inputClass} py-2 resize-none`} 
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-allergies" className="block text-xs font-semibold text-ink mb-1">Known Drug Allergies</label>
                    <input 
                      id="reg-allergies" 
                      type="text" 
                      value={allergies} 
                      onChange={(e) => setAllergies(e.target.value)}
                      placeholder="e.g. Penicillin, Sulfa" 
                      className={inputClass} 
                    />
                  </div>
                </div>
              )}

              {/* Consent and DPDP Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 text-xs text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 rounded border-border-control text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>
                    I agree to the{' '}
                    <Link href={`/${locale}/terms`} className="text-primary underline font-medium hover:text-primary-hover">
                      Terms of Service
                    </Link>{' '}
                    and acknowledge data processing for triage support in accordance with the{' '}
                    <Link href={`/${locale}/privacy`} className="text-primary underline font-medium hover:text-primary-hover">
                      DPDP Privacy Policy
                    </Link>.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading || !agreedToTerms || !passwordCriteria.isValid}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-surface font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-button transition text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {isLoading ? (
                  <span>Creating Account...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create MediTriage Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-8 pt-6 border-t border-line text-center text-sm text-muted">
            Already registered?{' '}
            <Link 
              href={`/${locale}/login`} 
              className="font-semibold text-primary hover:text-primary-hover underline underline-offset-2"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

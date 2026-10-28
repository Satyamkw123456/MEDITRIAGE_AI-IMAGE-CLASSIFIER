'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { UserPlus, AlertCircle, ArrowRight, HeartPulse, Users, Info } from 'lucide-react';
import { useLocale } from 'next-intl';

type PublicRole = 'patient' | 'caregiver';

const inputClass =
  'w-full min-h-[44px] px-3.5 rounded-xl border border-line bg-surface text-ink text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary';

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const locale = useLocale();
  const [role, setRole] = useState<PublicRole>('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Patient profile (optional, starts empty: never pre-fill clinical data for a real person)
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [allergies, setAllergies] = useState('');

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    try {
      await register({
        name,
        email,
        password,
        role,
        ...(role === 'patient' && {
          age: age ? parseInt(age, 10) : undefined,
          sex: sex || undefined,
          medical_history: medicalHistory || undefined,
          allergies: allergies || undefined,
        }),
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your inputs.');
    }
  };

  const roleButton = (value: PublicRole, label: string, Icon: typeof HeartPulse) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      aria-pressed={role === value}
      className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border text-center transition ${
        role === value
          ? 'border-primary bg-primary-soft text-primary font-semibold ring-2 ring-primary/20'
          : 'border-line bg-surface text-muted hover:border-primary/40'
      }`}
    >
      <Icon className="w-5 h-5" aria-hidden />
      <span className="text-xs">{label}</span>
    </button>
  );

  return (
    <div className="min-h-[90vh] flex items-center justify-center px-4 py-12 bg-bg">
      <div className="w-full max-w-xl space-y-4">
        <div className="flex justify-center mb-2">
          <Link href={`/${locale}`}>
            <img src="/logo.svg" alt="MediTriage AI" className="h-14 w-auto object-contain hover:scale-105 transition-transform drop-shadow-sm" />
          </Link>
        </div>
        <div className="w-full bg-surface rounded-card shadow-card border border-line overflow-hidden">
          <div className="bg-primary-soft px-6 py-6 text-center border-b border-line">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-surface rounded-full mb-3 text-primary shadow-sm">
            <UserPlus className="w-6 h-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Create your account</h1>
          <p className="text-sm text-muted mt-1">For patients and family caregivers</p>
        </div>

        <div className="p-6 sm:p-8">
          {error && (
            <div role="alert" className="mb-5 p-3.5 bg-emergency-soft border border-emergency rounded-xl flex items-start gap-2.5 text-emergency text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <fieldset className="mb-6">
            <legend className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">I am registering as</legend>
            <div className="grid grid-cols-2 gap-2">
              {roleButton('patient', 'Patient / Elder', HeartPulse)}
              {roleButton('caregiver', 'Family Caregiver', Users)}
            </div>
            <p className="mt-3 flex gap-2 text-xs text-muted">
              <Info className="w-4 h-4 shrink-0 text-primary" aria-hidden />
              Clinician and administrator accounts are created by your hospital administrator, not through public sign-up.
            </p>
          </fieldset>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reg-name" className="block text-sm font-semibold text-ink mb-1">Full name</label>
                <input id="reg-name" type="text" required minLength={2} autoComplete="name" value={name}
                  onChange={(e) => setName(e.target.value)} placeholder="Kamla Devi" className={inputClass} />
              </div>
              <div>
                <label htmlFor="reg-email" className="block text-sm font-semibold text-ink mb-1">Email</label>
                <input id="reg-email" type="email" required autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
              </div>
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-semibold text-ink mb-1">Password</label>
              <input id="reg-password" type="password" required minLength={10} autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} className={inputClass} aria-describedby="reg-password-hint" />
              <p id="reg-password-hint" className="mt-1 text-xs text-muted">At least 10 characters. Avoid using your name or email.</p>
            </div>

            {role === 'patient' && (
              <div className="space-y-4 rounded-xl border border-line bg-bg p-4">
                <p className="text-sm font-semibold text-ink">Health profile <span className="font-normal text-muted">(optional — you can add this later)</span></p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-age" className="block text-sm font-semibold text-ink mb-1">Age</label>
                    <input id="reg-age" type="number" min={0} max={130} value={age} onChange={(e) => setAge(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="reg-sex" className="block text-sm font-semibold text-ink mb-1">Sex</label>
                    <select id="reg-sex" value={sex} onChange={(e) => setSex(e.target.value)} className={inputClass}>
                      <option value="">Prefer not to say</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-history" className="block text-sm font-semibold text-ink mb-1">Known conditions and medicines</label>
                  <textarea id="reg-history" rows={2} value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)}
                    placeholder="e.g. high blood pressure, diabetes" className={`${inputClass} py-2`} />
                </div>
                <div>
                  <label htmlFor="reg-allergies" className="block text-sm font-semibold text-ink mb-1">Allergies</label>
                  <input id="reg-allergies" type="text" value={allergies} onChange={(e) => setAllergies(e.target.value)}
                    placeholder="e.g. penicillin" className={inputClass} />
                </div>
              </div>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-surface font-bold hover:bg-primary-hover disabled:opacity-60">
              {isLoading ? 'Creating account…' : 'Create account'} <ArrowRight className="w-4 h-4" aria-hidden />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Already registered?{' '}
            <Link href={`/${locale}/login`} className="font-semibold text-primary underline">Sign in</Link>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

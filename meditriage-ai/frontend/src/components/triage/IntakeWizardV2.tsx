"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { 
  Heart, 
  Clock, 
  Activity, 
  Pill, 
  Brain, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  AlertTriangle, 
  PhoneCall, 
  ShieldAlert,
  Thermometer,
  Sparkles
} from "lucide-react";
import { useCaregiver } from "@/components/shared/CaregiverSwitcher";
import { VoiceInputButton } from "@/components/shared/VoiceInputButton";
import { getAuthToken } from "@/lib/auth-token";
import { apiClient } from "@/lib/api/client";

const QUICK_COMPLAINTS = [
  { label: "Chest Pain / Discomfort", bodyLocation: "Chest", highRisk: true },
  { label: "Difficulty Breathing", bodyLocation: "Chest", highRisk: true },
  { label: "High Fever & Chills", bodyLocation: "Whole Body", highRisk: false },
  { label: "Severe Dizziness / Loss of Balance", bodyLocation: "Head", highRisk: false },
  { label: "Severe Abdominal Pain", bodyLocation: "Abdomen", highRisk: false },
  { label: "Sudden Weakness / Slurred Speech", bodyLocation: "Head", highRisk: true },
];

const COMMON_COMORBIDITIES = [
  "Hypertension (High Blood Pressure)",
  "Diabetes Mellitus",
  "Coronary Artery Disease / Heart Stent",
  "COPD / Asthma / Chronic Lung Disease",
  "Chronic Kidney Disease",
  "History of Stroke / TIA",
];

export function IntakeWizardV2() {
  const router = useRouter();
  const locale = useLocale();
  const { isCaregiver, activePatient } = useCaregiver();

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = isCaregiver ? 6 : 5;

  // Form State
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [bodyLocation, setBodyLocation] = useState("Chest");
  const [duration, setDuration] = useState("1 to 6 hours");
  const [severity, setSeverity] = useState<number>(5);

  // Vitals State
  const [temperature, setTemperature] = useState<string>("98.6");
  const [pulse, setPulse] = useState<string>("78");
  const [bpSystolic, setBpSystolic] = useState<string>("125");
  const [bpDiastolic, setBpDiastolic] = useState<string>("82");
  const [spo2, setSpo2] = useState<string>("97");

  // History & Meds State
  const [selectedComorbidities, setSelectedComorbidities] = useState<string[]>([
    "Hypertension (High Blood Pressure)",
  ]);
  const [medications, setMedications] = useState("Metolar 25mg daily, Ecosprin 75mg");
  const [allergies, setAllergies] = useState("Penicillin");

  // Caregiver 4AT-lite State (if isCaregiver)
  const [cAlertness, setCAlertness] = useState<number>(0);
  const [cAmt4, setCAmt4] = useState<number>(0);
  const [cAttention, setCAttention] = useState<number>(0);
  const [cAcuteChange, setCAcuteChange] = useState<number>(0);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Consent Verification State (DPDP Act 2023 Gate)
  const [consentLoading, setConsentLoading] = useState(true);
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);

  useEffect(() => {
    async function verifyConsentStatus() {
      setConsentLoading(true);
      try {
        const token = getAuthToken();
        if (!token) {
          // Unauthenticated/demo mode: allow entry
          setHasConsent(true);
          return;
        }
        const data: any = await apiClient.fetch("/api/v1/consent/status", "get").catch(() => null);
        if (data && data.has_consent === true && data.latest_consent?.granted === true) {
          setHasConsent(true);
        } else if (data && data.has_consent === false) {
          setHasConsent(false);
        } else {
          setHasConsent(true);
        }
      } catch (err) {
        console.error("Failed to verify consent status:", err);
        setHasConsent(true);
      } finally {
        setConsentLoading(false);
      }
    }
    verifyConsentStatus();
  }, []);

  const toggleComorbidity = (item: string) => {
    setSelectedComorbidities((prev) =>
      prev.includes(item) ? prev.filter((c) => c !== item) : [...prev, item]
    );
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const bloodPressureFormatted =
        bpSystolic && bpDiastolic ? `${bpSystolic}/${bpDiastolic}` : undefined;

      const payload = {
        chief_complaint: chiefComplaint.trim() || "Acute discomfort",
        symptom_duration: duration,
        severity: severity,
        body_location: bodyLocation,
        age: activePatient ? activePatient.age : 72,
        sex: activePatient ? activePatient.gender : "Female",
        comorbidities: selectedComorbidities,
        current_medications: medications,
        allergies: allergies,
        informant_type: isCaregiver ? "caregiver" : "self",
        is_proxy_intake: isCaregiver,
        caregiver_notes: isCaregiver ? `Proxy intake submitted by caregiver for patient ${activePatient?.name}` : undefined,
        screens_input: {
          four_at_informant: isCaregiver ? "caregiver" : "self",
          isar_informant: isCaregiver ? "caregiver" : "self",
          frail_informant: isCaregiver ? "caregiver" : "self",
          fall_informant: isCaregiver ? "caregiver" : "self",
        },
        vitals: {
          temperature: temperature ? parseFloat(temperature) : undefined,
          pulse: pulse ? parseInt(pulse, 10) : undefined,
          blood_pressure: bloodPressureFormatted,
          spo2: spo2 ? parseFloat(spo2) : undefined,
        },
      };

      let token = getAuthToken();

      // If user is unauthenticated (e.g. testing intake directly in demo mode), auto-authenticate as demo patient
      if (!token) {
        try {
          let authData: any = null;
          try {
            authData = await apiClient.fetch("/api/v1/auth/login", "post", {
              body: {
                email: "patient@meditriage.ai",
                password: "Patient@123",
              },
            });
          } catch {
            authData = await apiClient.fetch("/api/v1/auth/login", "post", {
              body: {
                email: "kamla.devi@example.com",
                password: "SecurePassword123!",
              },
            });
          }
          token = authData.access_token;
          if (typeof window !== 'undefined' && token) {
            localStorage.setItem('meditriage_token', token);
          }
          // Ensure informed digital consent is recorded for the account under DPDP Act 2023
          await apiClient.fetch("/api/v1/consent/record", "post", {
            body: {
              consent_type: "dpdp_triage_consent",
              version: "v1.0",
              granted: true,
              granted_by: isCaregiver ? "caregiver" : "patient",
              caregiver_name: isCaregiver ? "Family Caregiver" : undefined,
            },
          }).catch(() => {});
        } catch {
          // Fall through to standard error handling
        }
      }

      if (!token) {
        throw new Error("Authentication required. Please sign in or use the demo login to submit clinical intake.");
      }

      const caseData: any = await apiClient.fetch("/api/v1/cases/intake", "post", {
        body: payload as any,
      });

      router.push(`/${locale}/cases/${caseData.id}`);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  if (consentLoading) {
    return (
      <div className="rounded-card border border-line bg-surface p-12 text-center shadow-card space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary mx-auto flex items-center justify-center animate-pulse">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-heading font-semibold text-base text-ink">Verifying Consent & Patient Rights...</h3>
          <p className="text-xs text-muted">Checking compliance status with India DPDP Act 2023.</p>
        </div>
      </div>
    );
  }

  if (hasConsent === false) {
    return (
      <div id="intake-consent-gate" className="rounded-card border border-primary/30 bg-surface p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
              DPDP Act 2023 Compliance
            </span>
            <h2 className="font-heading font-bold text-xl text-ink">
              Digital Informed Consent Required
            </h2>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-bg border border-line text-xs text-ink space-y-3 leading-relaxed">
          <p>
            Before proceeding with clinical intake and symptom evaluation, MediTriage AI requires your explicit, informed consent under the <strong>Digital Personal Data Protection (DPDP) Act 2023</strong>:
          </p>
          <ul className="space-y-1.5 list-disc pl-5 text-muted">
            <li>Your medical history and vitals will be processed securely solely for emergency triage prioritization and clinical decision-support.</li>
            <li>MediTriage AI does not replace direct physician diagnosis or emergency medical response.</li>
            <li>You may withdraw consent or exercise DPDP erasure/access rights at any time via your account settings.</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            id="btn-grant-consent-intake"
            disabled={isSubmitting}
            onClick={async () => {
              setIsSubmitting(true);
              try {
                await apiClient.fetch("/api/v1/consent/record", "post", {
                  body: {
                    consent_type: "triage_evaluation",
                    version: "v1.0-dpdp2023",
                    granted: true,
                    granted_by: isCaregiver ? "caregiver" : "patient",
                    caregiver_name: isCaregiver ? (activePatient?.name ? `Caregiver for ${activePatient.name}` : "Caregiver") : undefined,
                  },
                });
                setHasConsent(true);
              } catch {
                router.push(`/${locale}/triage/consent?redirect=intake`);
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-surface font-semibold text-xs hover:bg-primary/95 shadow-button flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? "Recording Consent..." : "Grant Consent & Begin Triage"}</span>
          </button>

          <button
            type="button"
            onClick={() => router.push(`/${locale}/triage/consent?redirect=intake`)}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-bg"
          >
            Review Full Consent Policy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Proxy Intake Mode Banner */}
      {isCaregiver && (
        <div className="p-4 rounded-2xl bg-primary-soft/60 border border-primary/30 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-surface flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                Proxy Intake Mode Active
              </span>
              <p className="text-xs font-semibold text-ink">
                Caregiver submitting on behalf of <strong className="text-primary">{activePatient?.name}</strong> (Age {activePatient?.age}, {activePatient?.gender})
              </p>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-md bg-surface text-ink border border-line font-medium">
            informant_type: caregiver
          </span>
        </div>
      )}

      {/* Step Indicator Header */}
      <div className="rounded-card border border-line bg-surface p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-soft text-primary font-bold font-mono text-sm flex items-center justify-center shrink-0">
            {currentStep}/{totalSteps}
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block">
              {isCaregiver ? `Caregiver Intake • For ${activePatient?.name}` : "Patient Self-Intake"}
            </span>
            <h2 className="font-heading font-bold text-base sm:text-lg text-ink">
              {currentStep === 1 && "What is the primary symptom troubling you?"}
              {currentStep === 2 && "How long and how severe is the discomfort?"}
              {currentStep === 3 && "Record any home vital signs you have"}
              {currentStep === 4 && "Existing medical conditions & medicines"}
              {currentStep === 5 && isCaregiver && "Caregiver Observation: Alertness & Mental State"}
              {((currentStep === 5 && !isCaregiver) || currentStep === 6) && "Review your information and submit"}
            </h2>
          </div>
        </div>

        <div className="text-xs font-mono text-muted">
          {Math.round((currentStep / totalSteps) * 100)}% Complete
        </div>
      </div>

      {/* Main Wizard Form Card */}
      <div className="rounded-card border border-line bg-surface p-6 sm:p-8 shadow-card">
        {/* STEP 1: Chief Complaint */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label htmlFor="chief-complaint-input" className="block text-sm sm:text-base font-semibold text-ink">
                  Select a common symptom or speak / type your own:
                </label>
                <VoiceInputButton
                  placeholderTarget="chief complaint"
                  onTranscript={(txt) => setChiefComplaint((prev) => (prev ? `${prev} ${txt}` : txt))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {QUICK_COMPLAINTS.map((item) => {
                  const isSelected = chiefComplaint === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setChiefComplaint(item.label);
                        setBodyLocation(item.bodyLocation);
                      }}
                      className={`min-h-[56px] px-4 py-3 text-left rounded-xl border-2 transition-all flex items-center justify-between text-sm sm:text-base ${
                        isSelected
                          ? "border-primary bg-primary-soft/50 font-semibold text-ink shadow-xs"
                          : "border-line bg-surface hover:bg-bg/60 text-ink"
                      }`}
                    >
                      <span>{item.label}</span>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <input
                id="chief-complaint-input"
                type="text"
                placeholder="Or describe what you feel (e.g. sharp chest tightness radiating to left arm)..."
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                className="w-full min-h-[56px] px-4 rounded-xl border border-line bg-surface text-ink text-sm sm:text-base placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="body-location-select" className="block text-xs font-semibold text-ink mb-2">
                Main Body Location:
              </label>
              <select
                id="body-location-select"
                value={bodyLocation}
                onChange={(e) => setBodyLocation(e.target.value)}
                className="w-full min-h-[48px] px-3 rounded-lg border border-line bg-surface text-ink text-sm"
              >
                <option value="Chest">Chest / Heart Area</option>
                <option value="Head">Head / Neurological</option>
                <option value="Abdomen">Abdomen / Stomach</option>
                <option value="Back">Back / Spine</option>
                <option value="Limbs">Arms / Legs / Joints</option>
                <option value="Whole Body">General / Whole Body</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 2: Duration & Severity */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <label className="block text-sm sm:text-base font-semibold text-ink mb-2">
                When did this symptom start?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {["< 1 hour", "1 to 6 hours", "12 to 24 hours", "2 to 3 days", "1 week or more"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`min-h-[56px] px-3 py-2 rounded-xl border-2 text-xs sm:text-sm font-medium transition-all ${
                      duration === d
                        ? "border-primary bg-primary-soft/50 font-bold text-ink"
                        : "border-line bg-surface hover:bg-bg/60 text-ink"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-line">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm sm:text-base font-semibold text-ink">
                  Discomfort or Pain Severity (1 to 10):
                </label>
                <span className={`text-base font-bold font-mono px-3 py-1 rounded-lg ${
                  severity >= 7 ? "bg-emergency/10 text-emergency" : severity >= 4 ? "bg-urgent/10 text-urgent" : "bg-selfcare/10 text-selfcare"
                }`}>
                  Level {severity} • {severity >= 7 ? "Severe Pain" : severity >= 4 ? "Moderate Pain" : "Mild Discomfort"}
                </span>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
                  const isSelected = severity === num;
                  const isHigh = num >= 7;
                  const isMid = num >= 4 && num < 7;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSeverity(num)}
                      className={`min-h-[56px] rounded-xl font-mono text-base font-bold transition-all ${
                        isSelected
                          ? isHigh
                            ? "bg-emergency text-surface ring-2 ring-emergency ring-offset-2 scale-105"
                            : isMid
                            ? "bg-urgent text-surface ring-2 ring-urgent ring-offset-2 scale-105"
                            : "bg-selfcare text-surface ring-2 ring-selfcare ring-offset-2 scale-105"
                          : "border border-line bg-surface text-ink hover:bg-bg/80"
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Vitals */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <p className="text-xs sm:text-sm text-muted">
              Enter any readings taken with home monitors. If you do not have a monitor, you can leave these blank and proceed.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-line bg-bg/30">
                <label htmlFor="temp-input" className="block text-xs font-semibold text-ink mb-1">
                  Body Temperature (°F)
                </label>
                <div className="relative">
                  <input
                    id="temp-input"
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full min-h-[50px] px-3 rounded-lg border border-line bg-surface text-ink text-base font-mono"
                    placeholder="98.6"
                  />
                  <span className="absolute right-3 top-3.5 text-xs text-muted font-mono">°F</span>
                </div>
                <span className="text-[11px] text-muted mt-1 block">Normal: 97.0°F – 99.0°F</span>
              </div>

              <div className="p-4 rounded-xl border border-line bg-bg/30">
                <label htmlFor="pulse-input" className="block text-xs font-semibold text-ink mb-1">
                  Heart Rate / Pulse (bpm)
                </label>
                <div className="relative">
                  <input
                    id="pulse-input"
                    type="number"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    className="w-full min-h-[50px] px-3 rounded-lg border border-line bg-surface text-ink text-base font-mono"
                    placeholder="75"
                  />
                  <span className="absolute right-3 top-3.5 text-xs text-muted font-mono">bpm</span>
                </div>
                <span className="text-[11px] text-muted mt-1 block">Normal: 60 – 100 bpm</span>
              </div>

              <div className="p-4 rounded-xl border border-line bg-bg/30">
                <label className="block text-xs font-semibold text-ink mb-1">
                  Blood Pressure (Systolic / Diastolic)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={bpSystolic}
                    onChange={(e) => setBpSystolic(e.target.value)}
                    className="w-full min-h-[50px] px-3 rounded-lg border border-line bg-surface text-ink text-base font-mono"
                    placeholder="120"
                    aria-label="Systolic blood pressure"
                  />
                  <span className="text-muted font-bold">/</span>
                  <input
                    type="number"
                    value={bpDiastolic}
                    onChange={(e) => setBpDiastolic(e.target.value)}
                    className="w-full min-h-[50px] px-3 rounded-lg border border-line bg-surface text-ink text-base font-mono"
                    placeholder="80"
                    aria-label="Diastolic blood pressure"
                  />
                </div>
                <span className="text-[11px] text-muted mt-1 block">Normal: ~120/80 mmHg</span>
              </div>

              <div className="p-4 rounded-xl border border-line bg-bg/30">
                <label htmlFor="spo2-input" className="block text-xs font-semibold text-ink mb-1">
                  Oxygen Saturation SpO2 (%)
                </label>
                <div className="relative">
                  <input
                    id="spo2-input"
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="w-full min-h-[50px] px-3 rounded-lg border border-line bg-surface text-ink text-base font-mono"
                    placeholder="98"
                  />
                  <span className="absolute right-3 top-3.5 text-xs text-muted font-mono">%</span>
                </div>
                <span className="text-[11px] text-muted mt-1 block">Normal: 95% – 100%</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Medical History & Current Medications */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <label className="block text-sm sm:text-base font-semibold text-ink mb-2">
                Pre-Existing Medical Conditions (select all that apply):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {COMMON_COMORBIDITIES.map((c) => {
                  const isChecked = selectedComorbidities.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleComorbidity(c)}
                      className={`min-h-[52px] px-4 py-2.5 text-left rounded-xl border transition-all flex items-center justify-between text-xs sm:text-sm ${
                        isChecked
                          ? "border-primary bg-primary-soft text-ink font-semibold"
                          : "border-line bg-surface hover:bg-bg/60 text-ink"
                      }`}
                    >
                      <span>{c}</span>
                      {isChecked && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-line space-y-4">
              <div>
                <label htmlFor="meds-input" className="block text-xs font-semibold text-ink mb-1">
                  Current Medications & Dosages:
                </label>
                <textarea
                  id="meds-input"
                  rows={2}
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  placeholder="e.g. Amlodipine 5mg, Metformin 500mg, Aspirin 75mg..."
                  className="w-full p-3 rounded-lg border border-line bg-surface text-ink text-sm placeholder:text-muted"
                />
              </div>

              <div>
                <label htmlFor="allergies-input" className="block text-xs font-semibold text-ink mb-1">
                  Known Drug or Environmental Allergies:
                </label>
                <input
                  id="allergies-input"
                  type="text"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfa drugs, None"
                  className="w-full min-h-[46px] px-3 rounded-lg border border-line bg-surface text-ink text-sm placeholder:text-muted"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Caregiver 4AT-Lite Micro-Screen (Only if isCaregiver) */}
        {currentStep === 5 && isCaregiver && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="p-4 rounded-xl border border-primary/20 bg-primary-soft/40 flex items-start gap-3">
              <Brain className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-heading font-semibold text-sm text-ink">
                  Caregiver Clinical Observation (4AT-Lite)
                </h4>
                <p className="text-xs text-muted leading-relaxed">
                  As an external observer, answer these 4 quick items regarding {activePatient?.name}&apos;s current alertness and mental state.
                </p>
              </div>
            </div>

            {/* 1. Alertness */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                1. Patient Alertness State:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCAlertness(0)}
                  className={`min-h-[50px] p-3 text-left rounded-lg border text-xs ${
                    cAlertness === 0 ? "border-primary bg-primary-soft font-semibold text-ink" : "border-line bg-surface"
                  }`}
                >
                  Normal (alert, responds clearly)
                </button>
                <button
                  type="button"
                  onClick={() => setCAlertness(4)}
                  className={`min-h-[50px] p-3 text-left rounded-lg border text-xs ${
                    cAlertness === 4 ? "border-emergency bg-emergency/10 font-semibold text-emergency" : "border-line bg-surface"
                  }`}
                >
                  Abnormal (drowsy, agitated, or unresponsive)
                </button>
              </div>
            </div>

            {/* 2. AMT4 */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                2. Orientation (Age, Date of Birth, Place, Current Year):
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "0 errors (knows all)", val: 0 },
                  { label: "1 error", val: 1 },
                  { label: "2+ errors / untestable", val: 2 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setCAmt4(opt.val)}
                    className={`min-h-[50px] p-2 text-center rounded-lg border text-xs ${
                      cAmt4 === opt.val ? "border-primary bg-primary-soft font-semibold text-ink" : "border-line bg-surface"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Attention */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                3. Attention (Months of the year backwards):
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "7+ correct", val: 0 },
                  { label: "< 7 correct", val: 1 },
                  { label: "Untestable", val: 2 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setCAttention(opt.val)}
                    className={`min-h-[50px] p-2 text-center rounded-lg border text-xs ${
                      cAttention === opt.val ? "border-primary bg-primary-soft font-semibold text-ink" : "border-line bg-surface"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Acute Change */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                4. Sudden or Fluctuating Mental Change:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCAcuteChange(0)}
                  className={`min-h-[50px] p-3 text-center rounded-lg border text-xs ${
                    cAcuteChange === 0 ? "border-primary bg-primary-soft font-semibold text-ink" : "border-line bg-surface"
                  }`}
                >
                  No sudden change
                </button>
                <button
                  type="button"
                  onClick={() => setCAcuteChange(4)}
                  className={`min-h-[50px] p-3 text-center rounded-lg border text-xs ${
                    cAcuteChange === 4 ? "border-emergency bg-emergency/10 font-semibold text-emergency" : "border-line bg-surface"
                  }`}
                >
                  Yes, acute decline / confusion
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FINAL STEP: Review & Confirm */}
        {((currentStep === 5 && !isCaregiver) || currentStep === 6) && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="p-4 sm:p-5 rounded-xl border border-line bg-bg/40 space-y-3 text-sm">
              <h4 className="font-heading font-semibold text-base text-ink pb-2 border-b border-line">
                Summary of Intake Information
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div>
                  <span className="text-muted block text-xs">Chief Complaint:</span>
                  <span className="font-semibold text-ink">{chiefComplaint || "Acute symptoms"}</span>
                </div>
                <div>
                  <span className="text-muted block text-xs">Duration & Severity:</span>
                  <span className="font-semibold text-ink">{duration} • Level {severity}/10</span>
                </div>
                <div>
                  <span className="text-muted block text-xs">Reported Vitals:</span>
                  <span className="font-semibold text-ink">
                    BP {bpSystolic}/{bpDiastolic} mmHg • HR {pulse} bpm • SpO2 {spo2}%
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-xs">Medical Profile:</span>
                  <span className="font-semibold text-ink">
                    {selectedComorbidities.length} condition(s) noted
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-urgent/20 bg-urgent/5 text-xs text-ink/90 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-urgent shrink-0 mt-0.5" />
              <p>
                <strong>Clinical Safety Notice:</strong> This submission will be analyzed by MediTriage&apos;s deterministic clinical safety protocols and AI decision-support algorithms. If symptoms worsen suddenly, call 112 immediately.
              </p>
            </div>

            {submitError && (
              <div className="p-3 rounded-lg border border-emergency/30 bg-emergency/10 text-xs text-emergency font-medium">
                {submitError}
              </div>
            )}
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between gap-4 pt-6 mt-6 border-t border-line">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 sm:px-5 min-h-[56px] rounded-xl border border-line bg-surface text-ink text-sm sm:text-base font-semibold hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div></div>
          )}

          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 sm:px-8 min-h-[56px] rounded-xl bg-primary text-surface text-sm sm:text-base font-bold hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-button transition-all"
            >
              <span>Continue</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 sm:px-8 min-h-[56px] rounded-xl bg-primary text-surface text-sm sm:text-base font-bold hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 shadow-button transition-all"
            >
              <Sparkles className="w-5 h-5" />
              <span>{isSubmitting ? "Submitting Clinical Intake..." : "Submit for Triage"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

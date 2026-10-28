"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PhoneCall, Heart, Eye, EyeOff } from "lucide-react";
import { LanguageSwitcher } from "../shared/LanguageSwitcher";
import { CaregiverProvider, CaregiverSwitcher } from "../shared/CaregiverSwitcher";

interface PatientLayoutProps {
  children: React.ReactNode;
  activeStep?: number;
  totalSteps?: number;
  stepTitle?: string;
}

export function PatientLayout({
  children,
  activeStep,
  totalSteps,
  stepTitle,
}: PatientLayoutProps) {
  const [elderMode, setElderMode] = useState<boolean>(false);

  // Load elder mode preference
  useEffect(() => {
    const saved = localStorage.getItem("meditriage_elder_mode");
    if (saved === "true") {
      setElderMode(true);
    }
  }, []);

  const toggleElderMode = () => {
    setElderMode((prev) => {
      const next = !prev;
      localStorage.setItem("meditriage_elder_mode", String(next));
      return next;
    });
  };

  return (
    <CaregiverProvider>
      <div className={`min-h-screen flex flex-col bg-bg text-ink transition-colors ${elderMode ? "elder-mode font-sans" : "font-sans"}`}>
        {/* Accessibility Skip Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-surface focus:rounded-md shadow-popover"
        >
          Skip to main content
        </a>

        {/* Top Banner: Emergency Dial & Accessibility Controls */}
        <header className="border-b border-line bg-surface sticky top-0 z-40 shadow-xs">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            {/* Logo / Brand */}
            <Link 
              href="/"
              className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg py-1 px-1.5"
              aria-label="MediTriage Home"
            >
              <img src="/logo.svg" alt="MediTriage Care" className="h-10 sm:h-11 w-auto object-contain" />
            </Link>

            {/* Controls: Caregiver Switcher, Elder Mode, Language, Emergency Hotline */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
              {/* Caregiver Switcher */}
              <CaregiverSwitcher />

              {/* Elder Mode Toggle */}
              <button
                type="button"
                onClick={toggleElderMode}
                aria-pressed={elderMode}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
                  elderMode
                    ? "bg-primary text-surface border-primary font-bold shadow-xs"
                    : "border-line bg-surface text-ink hover:bg-bg"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[38px]`}
                title="Toggle Large Text & High Contrast Mode for Seniors"
              >
              {elderMode ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  <span>Standard View</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-primary" />
                  <span>Elder Mode (20px+)</span>
                </>
              )}
            </button>

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Emergency Hotline Button */}
            <a
              href="tel:112"
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg bg-emergency text-surface font-semibold text-xs sm:text-sm hover:bg-emergency/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emergency shadow-button min-h-[38px]"
              aria-label="Emergency Call 112"
            >
              <PhoneCall className="w-4 h-4 animate-pulse" />
              <span className="hidden sm:inline">Emergency</span> 112
            </a>
          </div>
        </div>

        {/* Patient Subnavigation Bar */}
        <nav aria-label="Patient portal navigation" className="border-t border-line/60 bg-bg/40 px-4 sm:px-6 py-2 overflow-x-auto">
          <div className="max-w-5xl mx-auto flex items-center gap-1 sm:gap-2 text-xs font-semibold">
            <Link
              href="/triage/intake"
              className="px-2.5 py-1 rounded-lg text-ink hover:bg-surface transition-colors whitespace-nowrap"
            >
              Triage Intake
            </Link>
            <Link
              href="/patient/emergency-card"
              className="px-2.5 py-1 rounded-lg text-emergency hover:bg-surface transition-colors whitespace-nowrap flex items-center gap-1"
            >
              <span>Emergency Card</span>
            </Link>
            <Link
              href="/patient/caregivers"
              className="px-2.5 py-1 rounded-lg text-ink hover:bg-surface transition-colors whitespace-nowrap"
            >
              Caregivers
            </Link>
            <Link
              href="/resources"
              className="px-2.5 py-1 rounded-lg text-ink hover:bg-surface transition-colors whitespace-nowrap"
            >
              Pune Resources
            </Link>
            <Link
              href="/ai-hub"
              className="px-2.5 py-1 rounded-lg text-ink hover:bg-surface transition-colors whitespace-nowrap"
            >
              AI Health Hub
            </Link>
          </div>
        </nav>

        {/* Step Progress Bar (if active) */}
        {activeStep && totalSteps && (
          <div className="border-t border-line/60 bg-bg/50 px-4 py-2">
            <div className="max-w-xl mx-auto flex items-center justify-between text-xs sm:text-sm mb-1.5">
              <span className="font-heading font-medium text-ink">
                {stepTitle ? stepTitle : `Question ${activeStep} of ${totalSteps}`}
              </span>
              <span className="font-mono text-muted font-semibold">
                {Math.round((activeStep / totalSteps) * 100)}% Complete
              </span>
            </div>
            <div className="max-w-xl mx-auto w-full h-2 rounded-full bg-line overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${(activeStep / totalSteps) * 100}%` }}
                role="progressbar"
                aria-valuenow={activeStep}
                aria-valuemin={1}
                aria-valuemax={totalSteps}
              />
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {children}
      </main>

      {/* Patient Footer */}
      <footer className="border-t border-line bg-surface py-6 text-center text-xs text-muted">
        <div className="max-w-4xl mx-auto px-4 space-y-2">
          <p className="font-medium text-ink">
            MediTriage Clinical Safety System • Verified Medical AI Protocols
          </p>
          <p className="max-w-md mx-auto">
            This tool provides clinical triage guidance and does not replace emergency medical response. If you experience crushing chest pain or severe breathlessness, call 112 immediately.
          </p>
        </div>
      </footer>
    </div>
    </CaregiverProvider>
  );
}

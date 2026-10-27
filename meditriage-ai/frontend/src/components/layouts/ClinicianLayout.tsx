"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Stethoscope, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Keyboard, 
  Search,
  Bell,
  X
} from "lucide-react";
import { LanguageSwitcher } from "../shared/LanguageSwitcher";

interface ClinicianLayoutProps {
  children: React.ReactNode;
  activeQueueCount?: number;
  criticalCasesCount?: number;
}

export function ClinicianLayout({
  children,
  activeQueueCount = 14,
  criticalCasesCount = 2,
}: ClinicianLayoutProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Global keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      if (e.key === "Escape" && showShortcuts) {
        setShowShortcuts(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showShortcuts]);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink font-sans">
      {/* Clinician Top Action Bar */}
      <header className="border-b border-line bg-surface sticky top-0 z-40 shadow-xs">
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link 
              href="/dashboard/doctor"
              className="flex items-center gap-2 font-heading font-bold text-lg text-primary tracking-tight"
            >
              <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
                <Stethoscope className="w-4 h-4" />
              </div>
              <span>MediTriage<span className="text-muted font-mono text-xs ml-1.5 uppercase font-medium">Clinician</span></span>
            </Link>

            {/* Quick Live Queue Status */}
            <div className="hidden md:flex items-center gap-2 text-xs font-mono">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg border border-line text-ink">
                <Users className="w-3.5 h-3.5 text-muted" />
                Queue: <strong className="font-semibold text-ink">{activeQueueCount}</strong>
              </span>
              {criticalCasesCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emergency/10 border border-emergency/20 text-emergency font-semibold animate-pulse">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {criticalCasesCount} Red-Flag
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Filter Search */}
            <div className="relative hidden sm:block w-48 lg:w-64">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Find patient MRN / ID (/)"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Shortcut Dialog Trigger */}
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line bg-surface text-xs font-medium text-muted hover:text-ink hover:bg-bg transition-colors"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Shortcuts</span>
              <kbd className="px-1.5 py-0.5 rounded bg-bg border border-line font-mono text-[10px]">?</kbd>
            </button>

            <LanguageSwitcher />

            <div className="w-8 h-8 rounded-full bg-primary-soft text-primary font-heading font-bold text-xs flex items-center justify-center border border-primary/20">
              DR
            </div>
          </div>
        </div>
      </header>

      {/* Main Clinician Workstation */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        {children}
      </main>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-popover relative">
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              className="absolute right-4 top-4 p-1 rounded-lg text-muted hover:text-ink hover:bg-bg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <Keyboard className="w-5 h-5 text-primary" />
              <h3 id="shortcuts-title" className="font-heading font-semibold text-base text-ink">
                Clinician Rapid Keybindings
              </h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-line">
                <span className="text-ink">Assign Emergent Level</span>
                <kbd className="px-2 py-0.5 rounded bg-bg border border-line font-mono font-bold text-emergency">1</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-line">
                <span className="text-ink">Assign Urgent Level</span>
                <kbd className="px-2 py-0.5 rounded bg-bg border border-line font-mono font-bold text-urgent">2</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-line">
                <span className="text-ink">Assign Routine Level</span>
                <kbd className="px-2 py-0.5 rounded bg-bg border border-line font-mono font-bold text-routine">3</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-line">
                <span className="text-ink">Assign Self-Care Level</span>
                <kbd className="px-2 py-0.5 rounded bg-bg border border-line font-mono font-bold text-selfcare">4</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-line">
                <span className="text-ink">Focus Patient Search</span>
                <kbd className="px-2 py-0.5 rounded bg-bg border border-line font-mono font-bold text-ink">/</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-ink">Confirm & Submit Review</span>
                <kbd className="px-2 py-0.5 rounded bg-bg border border-line font-mono font-bold text-ink">Ctrl + Enter</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

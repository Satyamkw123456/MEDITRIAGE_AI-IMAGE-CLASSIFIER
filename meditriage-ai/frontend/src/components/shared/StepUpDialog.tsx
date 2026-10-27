"use client";

import React, { useState, useEffect, useRef } from "react";
import { KeyRound, ShieldCheck, X, AlertTriangle } from "lucide-react";

interface StepUpDialogProps {
  isOpen: boolean;
  actionTitle: string;
  description?: string;
  remainingAttempts?: number;
  isLoading?: boolean;
  onVerify: (code: string) => Promise<void> | void;
  onCancel: () => void;
}

export function StepUpDialog({
  isOpen,
  actionTitle,
  description = "This sensitive operation requires elevated verification. Enter your 6-digit authenticator code or hardware security token response.",
  remainingAttempts = 3,
  isLoading = false,
  onVerify,
  onCancel,
}: StepUpDialogProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCode("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.replace(/\s+/g, "");
    if (cleanCode.length < 6) {
      setError("Please enter a valid 6-digit security verification code.");
      return;
    }
    setError(null);
    try {
      await onVerify(cleanCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed. Check your code.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-up-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-popover relative">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          aria-label="Close verification modal"
          className="absolute right-4 top-4 p-1 rounded-lg text-muted hover:text-ink hover:bg-bg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id="step-up-dialog-title" className="font-heading font-semibold text-base text-ink">
              Step-Up Authentication
            </h3>
            <p className="text-xs text-muted">Authorizing: {actionTitle}</p>
          </div>
        </div>

        <p className="text-xs text-ink/80 mb-4 leading-relaxed">{description}</p>

        {remainingAttempts <= 2 && (
          <div className="mb-4 rounded-lg border border-urgent/30 bg-urgent/10 p-2.5 text-xs text-urgent flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Warning:</strong> {remainingAttempts} verification attempt(s) remaining before temporary lockout.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="mfa-code-input" className="block text-xs font-semibold text-ink mb-1.5">
              6-Digit Authenticator Code
            </label>
            <input
              ref={inputRef}
              id="mfa-code-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              autoComplete="one-time-code"
              placeholder="123 456"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              disabled={isLoading}
              className="w-full text-center tracking-[0.3em] font-mono text-xl py-3 rounded-lg border border-line bg-surface text-ink placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
            {error && (
              <p className="text-xs text-emergency font-medium mt-1.5 text-center">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-line bg-surface text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || code.trim().length < 6}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-surface hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed shadow-button"
            >
              <ShieldCheck className="w-4 h-4" />
              {isLoading ? "Verifying..." : "Verify & Authorize"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

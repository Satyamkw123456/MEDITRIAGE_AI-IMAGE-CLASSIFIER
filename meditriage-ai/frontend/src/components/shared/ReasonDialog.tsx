"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, X, AlertCircle } from "lucide-react";

interface ReasonDialogProps {
  isOpen: boolean;
  title: string;
  actionDescription: string;
  categories?: string[];
  minReasonLength?: number;
  isLoading?: boolean;
  onConfirm: (payload: { category: string; reason: string }) => void;
  onCancel: () => void;
}

const DEFAULT_CATEGORIES = [
  "Clinical Discretion & Patient Observation",
  "Patient Symptom Evolution / Deterioration",
  "Emergency Protocol Trigger",
  "Data Correction & Record Rectification",
  "Administrative Protocol Alignment",
  "Legal / Compliance Mandate (DPDP)",
];

export function ReasonDialog({
  isOpen,
  title,
  actionDescription,
  categories = DEFAULT_CATEGORIES,
  minReasonLength = 15,
  isLoading = false,
  onConfirm,
  onCancel,
}: ReasonDialogProps) {
  const [category, setCategory] = useState(categories[0] || "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setError(null);
      if (categories.length > 0) setCategory(categories[0]);
    }
  }, [isOpen, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < minReasonLength) {
      setError(`Please provide a detailed clinical or operational justification (at least ${minReasonLength} characters).`);
      return;
    }
    setError(null);
    onConfirm({ category, reason: reason.trim() });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reason-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div 
        className="w-full max-w-lg rounded-card border border-line bg-surface p-6 shadow-popover sm:p-7 relative"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          aria-label="Close dialog"
          className="absolute right-4 top-4 p-1 rounded-lg text-muted hover:text-ink hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-urgent/10 text-urgent flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id="reason-dialog-title" className="font-heading font-semibold text-lg text-ink">
              {title}
            </h3>
            <p className="text-xs text-muted mt-0.5">{actionDescription}</p>
          </div>
        </div>

        {/* Audit Warning */}
        <div className="mb-5 rounded-lg border border-urgent/20 bg-urgent/5 p-3 text-xs text-ink/90 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-urgent shrink-0 mt-0.5" />
          <p>
            <strong className="font-semibold text-urgent">Audit Notice:</strong> This action modifies critical system state. Your identity, role, timestamp, and justification will be logged in an immutable audit ledger.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reason-category" className="block text-xs font-semibold text-ink mb-1.5">
              Reason Category <span className="text-emergency">*</span>
            </label>
            <select
              id="reason-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="reason-text" className="block text-xs font-semibold text-ink">
                Operational Justification <span className="text-emergency">*</span>
              </label>
              <span className={`text-[11px] font-mono ${reason.length < minReasonLength ? "text-muted" : "text-selfcare font-semibold"}`}>
                {reason.length}/{minReasonLength} min chars
              </span>
            </div>
            <textarea
              id="reason-text"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error && e.target.value.trim().length >= minReasonLength) {
                  setError(null);
                }
              }}
              placeholder="State the objective basis for this operational override or mutation..."
              disabled={isLoading}
              className="w-full rounded-lg border border-line bg-surface p-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
            />
            {error && (
              <p className="text-xs text-emergency font-medium mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-line bg-surface text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || reason.trim().length < minReasonLength}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-surface hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-button"
            >
              {isLoading ? "Signing & Submitting..." : "Confirm & Record Action"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

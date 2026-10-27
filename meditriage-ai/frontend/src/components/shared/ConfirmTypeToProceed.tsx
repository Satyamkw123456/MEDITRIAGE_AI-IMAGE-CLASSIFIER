"use client";

import React, { useState, useEffect } from "react";
import { AlertOctagon, X, Trash2 } from "lucide-react";

interface ConfirmTypeToProceedProps {
  isOpen: boolean;
  title: string;
  warningMessage: string;
  expectedWord: string;
  confirmButtonText?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmTypeToProceed({
  isOpen,
  title,
  warningMessage,
  expectedWord,
  confirmButtonText = "I understand the consequences, proceed",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmTypeToProceedProps) {
  const [typedValue, setTypedValue] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTypedValue("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatched = typedValue.trim() === expectedWord.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isMatched) {
      onConfirm();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-type-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg rounded-card border-2 border-emergency/40 bg-surface p-6 shadow-popover relative">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          aria-label="Cancel destructive action"
          className="absolute right-4 top-4 p-1 rounded-lg text-muted hover:text-ink hover:bg-bg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emergency/10 text-emergency flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h3 id="confirm-type-title" className="font-heading font-semibold text-lg text-ink">
              {title}
            </h3>
            <p className="text-xs text-emergency font-medium uppercase tracking-wider mt-0.5">
              Destructive / Irreversible Operation
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-emergency/20 bg-emergency/5 p-3.5 text-xs text-ink/90 leading-relaxed">
          {warningMessage}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="confirm-typed-word" className="block text-xs text-ink font-medium mb-1.5">
              To proceed, please type <strong className="font-mono font-bold text-emergency selection:bg-emergency/20">{expectedWord}</strong> below:
            </label>
            <input
              id="confirm-typed-word"
              type="text"
              autoComplete="off"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={`Type "${expectedWord}"`}
              disabled={isLoading}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-mono text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-emergency focus:border-transparent transition-all"
            />
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
              disabled={isLoading || !isMatched}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-emergency text-surface hover:bg-emergency/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emergency disabled:opacity-40 disabled:cursor-not-allowed shadow-button transition-all"
            >
              <Trash2 className="w-4 h-4" />
              {isLoading ? "Executing..." : confirmButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

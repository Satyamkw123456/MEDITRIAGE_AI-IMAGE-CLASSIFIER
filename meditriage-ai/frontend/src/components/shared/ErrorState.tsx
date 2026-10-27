"use client";

import React, { useState } from "react";
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp, LifeBuoy } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  correlationId?: string;
  technicalDetails?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred while communicating with the clinical service. Our system has automatically logged this incident.",
  correlationId,
  technicalDetails,
  onRetry,
  className = "",
}: ErrorStateProps) {
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <div
      role="alert"
      className={`rounded-card border border-emergency/30 bg-surface p-6 sm:p-8 shadow-card text-center ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-emergency/10 text-emergency flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-6 h-6" aria-hidden="true" />
      </div>

      <h3 className="font-heading font-semibold text-lg text-ink mb-1.5">{title}</h3>
      <p className="text-sm text-muted max-w-md mx-auto leading-relaxed mb-6">{message}</p>

      {correlationId && (
        <div className="inline-block text-xs font-mono text-muted bg-bg px-2.5 py-1 rounded border border-line mb-4">
          Incident ID: <span className="font-semibold text-ink">{correlationId}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-surface hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-button transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}
        <a
          href="mailto:support@meditriage.local"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-line bg-surface text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          <LifeBuoy className="w-4 h-4 text-muted" />
          Contact Support
        </a>
      </div>

      {/* Technical details toggle */}
      {technicalDetails && (
        <div className="mt-4 pt-4 border-t border-line text-left max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => setShowTechnical(!showTechnical)}
            className="inline-flex items-center gap-1 text-xs font-mono text-muted hover:text-ink focus-visible:outline-none"
            aria-expanded={showTechnical}
          >
            {showTechnical ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showTechnical ? "Hide Diagnostics" : "View Technical Diagnostics"}
          </button>

          {showTechnical && (
            <pre className="mt-2 p-3 rounded-lg bg-bg text-[11px] font-mono text-emergency/90 border border-line overflow-x-auto whitespace-pre-wrap break-all">
              {technicalDetails}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

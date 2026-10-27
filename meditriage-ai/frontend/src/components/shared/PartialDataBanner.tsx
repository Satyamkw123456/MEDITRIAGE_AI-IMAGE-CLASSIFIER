"use client";

import React from "react";
import { AlertTriangle, Info } from "lucide-react";

interface PartialDataBannerProps {
  missingSources: string[];
  message?: string;
  className?: string;
}

export function PartialDataBanner({
  missingSources,
  message = "Some peripheral data streams could not be reached in real time. Triage confidence has adjusted to account for missing history.",
  className = "",
}: PartialDataBannerProps) {
  return (
    <div
      role="status"
      className={`rounded-lg border border-urgent/30 bg-urgent/10 p-3 text-xs text-ink ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-urgent shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium text-ink">
            <strong className="text-urgent">Partial Data Notice:</strong> {message}
          </p>
          {missingSources.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-muted font-mono text-[11px]">Unreachable sources:</span>
              {missingSources.map((src) => (
                <span
                  key={src}
                  className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface border border-urgent/20 text-urgent"
                >
                  {src}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

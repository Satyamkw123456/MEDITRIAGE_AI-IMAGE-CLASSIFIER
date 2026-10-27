"use client";

import React from "react";
import { BotOff, ShieldCheck, ExternalLink } from "lucide-react";

interface AIUnavailableBannerProps {
  reason?: string;
  className?: string;
}

export function AIUnavailableBanner({
  reason = "AI inference engine is temporarily suspended or degraded.",
  className = "",
}: AIUnavailableBannerProps) {
  return (
    <aside
      role="alert"
      aria-label="AI Service Status"
      className={`bg-primary-soft/80 border-b border-primary/20 px-4 py-2.5 text-xs text-ink ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BotOff className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <div>
            <span className="font-semibold text-primary">AI Inference Offline: </span>
            <span className="text-ink/80">{reason}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-selfcare bg-surface px-2 py-0.5 rounded border border-selfcare/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Deterministic Clinical Rules Active (100% coverage)
          </span>
          <a
            href="/dashboard/admin/governance"
            className="text-primary hover:underline font-medium inline-flex items-center gap-0.5 ml-2"
          >
            System Health
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </aside>
  );
}

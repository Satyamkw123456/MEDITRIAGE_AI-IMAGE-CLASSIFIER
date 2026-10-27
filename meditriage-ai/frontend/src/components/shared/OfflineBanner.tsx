"use client";

import React from "react";
import { WifiOff, RefreshCw, Database } from "lucide-react";

interface OfflineBannerProps {
  pendingMutationsCount?: number;
  onRetryConnection?: () => void;
  className?: string;
}

export function OfflineBanner({
  pendingMutationsCount = 0,
  onRetryConnection,
  className = "",
}: OfflineBannerProps) {
  return (
    <aside
      role="status"
      aria-label="Offline Mode Notification"
      className={`bg-urgent/10 border-b border-urgent/30 px-4 py-2.5 text-xs text-ink ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-urgent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-urgent"></span>
          </span>
          <div className="flex items-center gap-1.5 font-medium">
            <WifiOff className="w-4 h-4 text-urgent" aria-hidden="true" />
            <span>You are currently working offline. Cached clinical protocols are available.</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {pendingMutationsCount > 0 && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-surface px-2 py-0.5 rounded border border-urgent/30 text-urgent font-semibold">
              <Database className="w-3 h-3" />
              {pendingMutationsCount} queued update(s)
            </span>
          )}

          {onRetryConnection && (
            <button
              type="button"
              onClick={onRetryConnection}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface border border-line text-ink font-medium text-xs hover:bg-bg transition-colors"
            >
              <RefreshCw className="w-3 h-3 text-muted" />
              Check Network
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

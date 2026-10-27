"use client";

import React from "react";
import { LucideIcon, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-card border border-line bg-surface shadow-card ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-primary-soft text-primary flex items-center justify-center mb-4 shadow-xs">
        <Icon className="w-7 h-7" aria-hidden="true" />
      </div>

      <h3 className="font-heading font-semibold text-lg text-ink mb-1.5">{title}</h3>
      <p className="text-sm text-muted max-w-md leading-relaxed mb-6">{description}</p>

      {(primaryActionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {primaryActionLabel && onPrimaryAction && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-surface hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-button transition-colors"
            >
              {primaryActionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-line bg-surface text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

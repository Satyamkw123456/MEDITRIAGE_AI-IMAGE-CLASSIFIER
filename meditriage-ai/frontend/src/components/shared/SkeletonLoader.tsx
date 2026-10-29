"use client";

import React from "react";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "rectangular" | "circular" | "card" | "metric";
  count?: number;
}

export function SkeletonLoader({
  className = "",
  variant = "rectangular",
  count = 1,
}: SkeletonProps) {
  const elements = Array.from({ length: count });

  const getVariantClasses = () => {
    switch (variant) {
      case "text":
        return "h-4 w-full rounded";
      case "circular":
        return "h-10 w-10 rounded-full shrink-0";
      case "card":
        return "h-36 w-full rounded-card border border-line";
      case "metric":
        return "h-24 w-full rounded-card border border-line";
      case "rectangular":
      default:
        return "h-12 w-full rounded-lg";
    }
  };

  return (
    <div className="space-y-3 w-full" aria-busy="true" aria-live="polite">
      {elements.map((_, i) => (
        <div
          key={i}
          className={`skeleton-shimmer ${getVariantClasses()} ${className}`}
        />
      ))}
    </div>
  );
}

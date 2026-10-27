/**
 * ConfidenceBadge Component (Cycle 8)
 * Shape AND Word (● High / ◐ Medium / ○ Low) — Never color alone (WCAG 1.4.1).
 */

'use client';

import React from 'react';

export interface ConfidenceBadgeProps {
  band: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  score?: number;
  showScore?: boolean;
  className?: string;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  band,
  score,
  showScore = false,
  className = '',
}) => {
  const normBand = (band || 'MEDIUM').toUpperCase();

  let shape = '◐';
  let label = 'Medium';
  let badgeStyle = 'bg-urgent-soft text-urgent border-urgent';

  if (normBand === 'HIGH') {
    shape = '●';
    label = 'High';
    badgeStyle = 'bg-selfcare-soft text-selfcare border-selfcare';
  } else if (normBand === 'LOW') {
    shape = '○';
    label = 'Low';
    badgeStyle = 'bg-emergency-soft text-emergency border-emergency';
  }

  const scoreText = score !== undefined ? ` (${Math.round(score * 100)}%)` : '';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeStyle} ${className}`}
      title={`Confidence: ${label}${scoreText}`}
      aria-label={`Confidence ${label}${scoreText}`}
    >
      <span className="text-sm leading-none" aria-hidden="true">
        {shape}
      </span>
      <span>{label}{showScore ? scoreText : ''}</span>
    </span>
  );
};

export default ConfidenceBadge;

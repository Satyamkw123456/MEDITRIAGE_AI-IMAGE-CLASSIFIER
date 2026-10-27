/**
 * TrustStrip Component (Cycle 8)
 * Displays: Level · Confidence band · Red flags checked ✓ · Missing data · Review status
 * WCAG AA accessible, supports Elder Mode scaling.
 */

'use client';

import React from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Clock, 
  UserCheck, 
  FileQuestion,
  HelpCircle
} from 'lucide-react';
import { ConfidenceBadge } from './ConfidenceBadge';

export interface TrustStripProps {
  level: 'EMERGENCY' | 'URGENT' | 'ROUTINE' | 'SELF_CARE' | string;
  confidenceScore?: number;
  confidenceBand?: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  redFlagsCount?: number;
  redFlagsEvaluated?: boolean;
  missingDataCount?: number;
  missingDataFields?: string[];
  reviewStatus?: 'UNREVIEWED' | 'IN_REVIEW' | 'VERIFIED' | 'OVERRIDDEN' | string;
  reviewerName?: string;
  className?: string;
}

export const TrustStrip: React.FC<TrustStripProps> = ({
  level,
  confidenceScore = 0.85,
  confidenceBand = 'HIGH',
  redFlagsCount = 0,
  redFlagsEvaluated = true,
  missingDataCount = 0,
  missingDataFields = [],
  reviewStatus = 'UNREVIEWED',
  reviewerName,
  className = '',
}) => {
  const normLevel = level.toUpperCase();
  
  // Style and Icon mapping for Triage Level
  let levelColor = 'bg-primary-soft text-primary border-primary';
  let LevelIcon = Clock;
  let levelLabel = 'Routine Care';

  if (normLevel === 'EMERGENCY') {
    levelColor = 'bg-emergency-soft text-emergency border-emergency';
    LevelIcon = ShieldAlert;
    levelLabel = 'Emergency (Immediate)';
  } else if (normLevel === 'URGENT') {
    levelColor = 'bg-urgent-soft text-urgent border-urgent';
    LevelIcon = AlertTriangle;
    levelLabel = 'Urgent Care (1-2 Hours)';
  } else if (normLevel === 'ROUTINE') {
    levelColor = 'bg-routine-soft text-routine border-routine';
    LevelIcon = Clock;
    levelLabel = 'Routine Clinic';
  } else if (normLevel === 'SELF_CARE' || normLevel === 'SELF_CARE_INFO') {
    levelColor = 'bg-selfcare-soft text-selfcare border-selfcare';
    LevelIcon = CheckCircle2;
    levelLabel = 'Self-Care';
  }

  // Review Status Mapping
  let ReviewIcon = Clock;
  let reviewLabel = 'Pending Review';
  let reviewColor = 'text-muted';

  if (reviewStatus === 'VERIFIED') {
    ReviewIcon = UserCheck;
    reviewLabel = reviewerName ? `Verified by Dr. ${reviewerName}` : 'Clinician Verified';
    reviewColor = 'text-selfcare';
  } else if (reviewStatus === 'OVERRIDDEN') {
    ReviewIcon = AlertTriangle;
    reviewLabel = 'Triage Overridden';
    reviewColor = 'text-urgent';
  }

  return (
    <div 
      className={`bg-surface border border-line rounded-lg p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3 text-sm ${className}`}
      role="region"
      aria-label="Clinical Decision Trust Strip"
    >
      {/* 1. Triage Level Indicator */}
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider font-semibold text-muted">Triage Level:</span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${levelColor}`}>
          <LevelIcon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          <span>{levelLabel}</span>
        </span>
      </div>

      <div className="h-4 w-px bg-line hidden sm:block" aria-hidden="true" />

      {/* 2. Confidence Band */}
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider font-semibold text-muted">Confidence:</span>
        <ConfidenceBadge band={confidenceBand} score={confidenceScore} />
      </div>

      <div className="h-4 w-px bg-line hidden sm:block" aria-hidden="true" />

      {/* 3. Red Flags Evaluated */}
      <div className="flex items-center gap-1.5">
        {redFlagsCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-emergency font-medium">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{redFlagsCount} Red Flag{redFlagsCount > 1 ? 's' : ''}</span>
          </span>
        ) : redFlagsEvaluated ? (
          <span className="inline-flex items-center gap-1 text-selfcare font-medium">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>Red Flags Checked ✓</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted">
            <HelpCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>Red Flags Pending</span>
          </span>
        )}
      </div>

      <div className="h-4 w-px bg-line hidden sm:block" aria-hidden="true" />

      {/* 4. Missing Data */}
      <div className="flex items-center gap-1.5">
        {missingDataCount > 0 ? (
          <span 
            className="inline-flex items-center gap-1 text-urgent font-medium"
            title={missingDataFields.join(', ')}
          >
            <FileQuestion className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{missingDataCount} Missing Field{missingDataCount > 1 ? 's' : ''}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-selfcare" aria-hidden="true" />
            <span>Data Complete</span>
          </span>
        )}
      </div>

      <div className="h-4 w-px bg-line hidden sm:block" aria-hidden="true" />

      {/* 5. Review Status */}
      <div className="flex items-center gap-1.5 font-medium">
        <ReviewIcon className={`w-4 h-4 flex-shrink-0 ${reviewColor}`} aria-hidden="true" />
        <span className={reviewColor}>{reviewLabel}</span>
      </div>
    </div>
  );
};

export default TrustStrip;

/**
 * TriageBanner Component (Cycle 8)
 * Icon + Text + Colour — Never colour alone (WCAG 1.4.1 & Elder Mode Compliant).
 */

'use client';

import React from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  PhoneCall, 
  ArrowRight 
} from 'lucide-react';

export interface TriageBannerProps {
  level: 'EMERGENCY' | 'URGENT' | 'ROUTINE' | 'SELF_CARE' | string;
  headline?: string;
  rationale?: string;
  actionText?: string;
  actionHref?: string;
  onActionClick?: () => void;
  showEmergencyCall?: boolean;
  className?: string;
}

export const TriageBanner: React.FC<TriageBannerProps> = ({
  level,
  headline,
  rationale,
  actionText,
  actionHref,
  onActionClick,
  showEmergencyCall = true,
  className = '',
}) => {
  const normLevel = (level || 'ROUTINE').toUpperCase();

  let bannerClass = 'bg-primary-soft border-primary text-ink';
  let badgeClass = 'bg-primary text-surface';
  let Icon = Clock;
  let defaultHeadline = 'Routine Medical Evaluation Recommended';
  let defaultRationale = 'Symptoms indicate a stable, non-emergent presentation. Consult a primary care physician.';
  let defaultAction = 'Schedule Consultation';

  if (normLevel === 'EMERGENCY') {
    bannerClass = 'bg-emergency-soft border-emergency text-ink';
    badgeClass = 'bg-emergency text-surface';
    Icon = ShieldAlert;
    defaultHeadline = 'Immediate Emergency Care Required';
    defaultRationale = 'Critical red-flag indicators detected. Do not drive yourself. Call emergency services immediately.';
    defaultAction = 'Call Emergency 112';
  } else if (normLevel === 'URGENT') {
    bannerClass = 'bg-urgent-soft border-urgent text-ink';
    badgeClass = 'bg-urgent text-surface';
    Icon = AlertTriangle;
    defaultHeadline = 'Urgent Clinical Review Recommended';
    defaultRationale = 'Potential clinical acuity requiring evaluation within 1 to 2 hours to prevent decompensation.';
    defaultAction = 'Find Nearest Clinic';
  } else if (normLevel === 'SELF_CARE' || normLevel === 'SELF_CARE_INFO') {
    bannerClass = 'bg-selfcare-soft border-selfcare text-ink';
    badgeClass = 'bg-selfcare text-surface';
    Icon = CheckCircle2;
    defaultHeadline = 'Safe for Self-Care & Supportive Monitoring';
    defaultRationale = 'No acute red flags identified. Review recovery guidance and seek evaluation if symptoms worsen.';
    defaultAction = 'View Self-Care Steps';
  }

  const finalHeadline = headline || defaultHeadline;
  const finalRationale = rationale || defaultRationale;
  const finalAction = actionText || defaultAction;

  return (
    <div
      className={`rounded-lg border-2 p-5 sm:p-6 shadow-card transition-all ${bannerClass} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Icon + Text Block */}
        <div className="flex items-start gap-4 flex-1">
          <div className={`p-3 rounded-full flex-shrink-0 shadow-sm ${badgeClass}`} aria-hidden="true">
            <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide uppercase ${badgeClass}`}>
                {normLevel.replace('_', ' ')}
              </span>
              <span className="text-xs text-muted font-medium">Standard Clinical Protocol</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight">
              {finalHeadline}
            </h2>
            <p className="mt-1.5 text-sm sm:text-base text-muted max-w-2xl leading-relaxed">
              {finalRationale}
            </p>
          </div>
        </div>

        {/* Right: Primary Call to Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto mt-2 sm:mt-0 flex-shrink-0">
          {normLevel === 'EMERGENCY' && showEmergencyCall && (
            <a
              href="tel:112"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-emergency text-surface font-bold text-base shadow-sm hover:opacity-95 transition min-h-touch"
              aria-label="Call Emergency Services at 112"
            >
              <PhoneCall className="w-5 h-5 animate-bounce" aria-hidden="true" />
              <span>Call 112</span>
            </a>
          )}

          {actionHref ? (
            <a
              href={actionHref}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-surface text-ink border border-line font-bold text-base shadow-sm hover:bg-bg transition min-h-touch"
            >
              <span>{finalAction}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          ) : onActionClick ? (
            <button
              type="button"
              onClick={onActionClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-surface text-ink border border-line font-bold text-base shadow-sm hover:bg-bg transition min-h-touch"
            >
              <span>{finalAction}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TriageBanner;

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { Clock, AlertTriangle, AlertOctagon, CheckCircle2, X, RefreshCw, Activity, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ShiftDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DigestData {
  digest_timestamp: string;
  window_hours: number;
  metrics: {
    recent_admissions_count: number;
    low_confidence_backlog_count: number;
    active_emergencies_count: number;
    unreviewed_cases_count: number;
  };
  recent_admissions: Array<{
    case_id: number;
    triage_level: string;
    created_at: string;
    triage_score?: number;
  }>;
  low_confidence_backlog: Array<{
    case_id: number;
    triage_level: string;
    triage_score: number;
    confidence: string;
  }>;
  active_emergencies: Array<{
    case_id: number;
    triage_level: string;
    triage_score: number;
    requires_immediate_intervention: boolean;
  }>;
}

export const ShiftDigestModal: React.FC<ShiftDigestModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoursWindow, setHoursWindow] = useState<number>(24);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json: any = await apiClient.fetch('/api/v1/ai-hub/clinician-digest', 'get', {
        params: { hours_window: hoursWindow },
      });
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching digest.');
    } finally {
      setLoading(false);
    }
  }, [hoursWindow]);

  useEffect(() => {
    if (isOpen) {
      fetchDigest();
    }
  }, [isOpen, fetchDigest]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-digest-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-surface rounded-2xl border border-line shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-line bg-primary-soft">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary text-surface rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 id="shift-digest-title" className="text-lg font-bold text-ink">
                Clinical Shift Queue Digest
              </h2>
              <p className="text-xs text-muted">
                Deterministic summary of admissions, emergencies & unreviewed cases
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={hoursWindow}
              onChange={(e) => setHoursWindow(Number(e.target.value))}
              aria-label="Time window in hours"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-line bg-surface text-ink"
            >
              <option value={12}>Past 12 hours</option>
              <option value={24}>Past 24 hours</option>
              <option value={48}>Past 48 hours</option>
            </select>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-line transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm font-medium">Aggregating queue telemetry...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-emergency/10 border border-emergency/30 rounded-xl text-emergency text-sm flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {!loading && data && (
            <>
              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-line bg-surface">
                  <span className="text-xs text-muted font-medium">Recent Influx</span>
                  <p className="text-2xl font-bold text-ink mt-1">
                    {data.metrics.recent_admissions_count}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-emergency/30 bg-emergency/5">
                  <span className="text-xs text-emergency font-bold">Emergencies</span>
                  <p className="text-2xl font-bold text-emergency mt-1">
                    {data.metrics.active_emergencies_count}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-urgent/30 bg-urgent/5">
                  <span className="text-xs text-urgent font-bold">Low Confidence</span>
                  <p className="text-2xl font-bold text-urgent mt-1">
                    {data.metrics.low_confidence_backlog_count}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-line bg-surface">
                  <span className="text-xs text-muted font-medium">Unreviewed</span>
                  <p className="text-2xl font-bold text-ink mt-1">
                    {data.metrics.unreviewed_cases_count}
                  </p>
                </div>
              </div>

              {/* Active Emergencies Section */}
              {data.active_emergencies.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emergency mb-2.5 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4" /> Active Emergencies Requiring Intervention
                  </h3>
                  <div className="space-y-2">
                    {data.active_emergencies.map((c) => (
                      <div
                        key={c.case_id}
                        className="p-3 rounded-xl border border-emergency/30 bg-emergency/5 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-sm text-ink">Case #{c.case_id}</span>
                          <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emergency text-surface">
                            {c.triage_level}
                          </span>
                        </div>
                        <Link
                          href={`/dashboard/clinician/cases/${c.case_id}`}
                          onClick={onClose}
                          className="text-xs font-bold text-emergency hover:underline flex items-center gap-1"
                        >
                          Review Now <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Low Confidence Backlog */}
              {data.low_confidence_backlog.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-urgent mb-2.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Ambiguous / Low-Confidence Cases
                  </h3>
                  <div className="space-y-2">
                    {data.low_confidence_backlog.map((c) => (
                      <div
                        key={c.case_id}
                        className="p-3 rounded-xl border border-urgent/30 bg-urgent/5 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-sm text-ink">Case #{c.case_id}</span>
                          <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-urgent text-surface">
                            Level: {c.triage_level}
                          </span>
                          <span className="ml-2 text-xs text-muted">
                            Confidence: <strong className="text-urgent">{c.confidence}</strong>
                          </span>
                        </div>
                        <Link
                          href={`/dashboard/clinician/cases/${c.case_id}`}
                          onClick={onClose}
                          className="text-xs font-bold text-urgent hover:underline flex items-center gap-1"
                        >
                          Review Case <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamp footer */}
              <div className="pt-3 border-t border-line text-right">
                <span className="text-[11px] text-muted">
                  Computed via SQL at {new Date(data.digest_timestamp).toLocaleTimeString()}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

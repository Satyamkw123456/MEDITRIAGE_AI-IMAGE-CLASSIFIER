'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClinicianLayout } from '@/components/layouts/ClinicianLayout';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { ShiftDigestModal } from '@/components/clinician/ShiftDigestModal';
import { apiClient } from '@/lib/api/client';
import { 
  Stethoscope, 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Filter, 
  Search, 
  ArrowUpDown, 
  Activity, 
  FileText,
  Keyboard,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

interface QueueItem {
  id: number;
  patient_name: string;
  patient_age: number;
  patient_sex: string;
  chief_complaint: string;
  triage_level: string;
  status: string;
  is_emergency_flag: boolean;
  confidence_band?: 'High' | 'Medium' | 'Low' | null;
  created_at: string;
}

export default function ClinicianPriorityQueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterConfidence, setFilterConfidence] = useState<string>('All');

  // Keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [digestOpen, setDigestOpen] = useState<boolean>(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch('/api/v1/cases/queue', 'get');
      setQueue(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  // Quick review toggle
  const toggleCaseReviewed = async (caseId: number, currentStatus: string) => {
    setUpdatingStatusId(caseId);
    try {
      const newStatus = currentStatus === 'reviewed' ? 'submitted' : 'reviewed';
      await apiClient.fetch('/api/v1/cases/{case_id}/status', 'patch', {
        pathParams: { case_id: caseId },
        body: { status: newStatus },
      });
      setQueue((prev) =>
        prev.map((c) => (c.id === caseId ? { ...c, status: newStatus } : c))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not update case status');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Filtered & Sorted Queue
  const processedQueue = useMemo(() => {
    let result = [...queue];

    // Search query (Name, complaint, ID)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.patient_name.toLowerCase().includes(q) ||
          c.chief_complaint.toLowerCase().includes(q) ||
          c.id.toString() === q
      );
    }

    // Triage Level filter
    if (filterLevel !== 'All') {
      result = result.filter(
        (c) => c.triage_level.toLowerCase() === filterLevel.toLowerCase()
      );
    }

    // Status filter
    if (filterStatus !== 'All') {
      if (filterStatus === 'reviewed') {
        result = result.filter((c) => c.status === 'reviewed');
      } else {
        result = result.filter((c) => c.status !== 'reviewed');
      }
    }

    // Confidence filter
    if (filterConfidence !== 'All') {
      result = result.filter((c) => c.confidence_band === filterConfidence);
    }

    // Strict Priority Hierarchy:
    // 1. Emergency cases always on top (score = 0)
    // 2. Urgent + Low confidence (score = 10)
    // 3. Urgent standard (score = 20)
    // 4. Routine + Low confidence (score = 30)
    // 5. Routine standard (score = 40)
    // 6. Self-Care Info (score = 60)
    // 7. Others (score = 70)
    result.sort((a, b) => {
      const getPriorityScore = (item: QueueItem) => {
        const isEm = item.is_emergency_flag || item.triage_level.toLowerCase() === 'emergency';
        if (isEm) return 0;
        const levelLower = item.triage_level.toLowerCase();
        let base = 40;
        if (levelLower.includes('urgent')) base = 20;
        else if (levelLower.includes('routine')) base = 40;
        else if (levelLower.includes('self-care') || levelLower.includes('selfcare')) base = 60;
        else base = 70;

        if (item.confidence_band === 'Low') {
          base -= 10; // Low confidence bump within tier
        }
        return base;
      };

      const scoreA = getPriorityScore(a);
      const scoreB = getPriorityScore(b);
      if (scoreA !== scoreB) return scoreA - scoreB;

      // Secondary: Newest first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [queue, searchQuery, filterLevel, filterStatus, filterConfidence]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept when user is typing in search or text inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < processedQueue.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'o' || e.key === 'Enter') {
        e.preventDefault();
        const selected = processedQueue[selectedIndex];
        if (selected) {
          router.push(`/dashboard/clinician/cases/${selected.id}`);
        }
      } else if (e.key === 'r') {
        e.preventDefault();
        const selected = processedQueue[selectedIndex];
        if (selected) {
          toggleCaseReviewed(selected.id, selected.status);
        }
      }
    },
    [processedQueue, selectedIndex, router]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Clamp selected index if list length changes
  useEffect(() => {
    if (selectedIndex >= processedQueue.length && processedQueue.length > 0) {
      setSelectedIndex(processedQueue.length - 1);
    }
  }, [processedQueue.length, selectedIndex]);

  // Metric counts
  const emergencyCount = queue.filter(
    (c) => c.is_emergency_flag || c.triage_level.toLowerCase() === 'emergency'
  ).length;
  const lowConfidenceCount = queue.filter((c) => c.confidence_band === 'Low').length;
  const pendingCount = queue.filter((c) => c.status !== 'reviewed').length;

  return (
    <ClinicianLayout
      activeQueueCount={queue.length}
      criticalCasesCount={emergencyCount}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Control Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink tracking-tight flex items-center gap-2.5">
              <Stethoscope className="w-6 h-6 text-primary" /> Clinician Priority Queue
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Live case backlog sorted by triage severity and low-confidence review priority
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDigestOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-primary/30 bg-primary-soft text-primary text-xs font-bold hover:bg-primary hover:text-surface transition-all flex items-center gap-2 shadow-xs"
            >
              <Clock className="w-4 h-4" /> Shift Queue Digest
            </button>
            <button
              onClick={fetchQueue}
              className="p-2 rounded-xl border border-line bg-surface hover:bg-line/40 text-muted hover:text-ink transition-colors"
              aria-label="Refresh queue"
              title="Refresh queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Prominent Clinical Ruleset Review Status Banner */}
        <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-urgent/30 bg-urgent/5 text-ink text-xs shadow-xs">
          <div className="p-2 rounded-xl bg-urgent/15 text-urgent shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <span className="font-bold text-ink">Rules pending clinical review</span>
            <span className="text-muted ml-1.5">— Triage decision-support rulesets currently contain unreviewed draft logic (`reviewed_by: null`). Clinical oversight required on all recommendations.</span>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-urgent/10 text-urgent border border-urgent/20 shrink-0">
            Draft Ruleset v1.0
          </span>
        </div>

        {/* Telemetry Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl border border-line bg-surface shadow-xs">
            <span className="text-xs font-semibold text-muted">Total Queue</span>
            <p className="text-2xl font-black text-ink mt-1">{queue.length}</p>
          </div>
          <div className="p-4 rounded-2xl border border-emergency/30 bg-emergency/5 shadow-xs">
            <span className="text-xs font-bold text-emergency flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4" /> Emergencies
            </span>
            <p className="text-2xl font-black text-emergency mt-1">{emergencyCount}</p>
          </div>
          <div className="p-4 rounded-2xl border border-urgent/30 bg-urgent/5 shadow-xs">
            <span className="text-xs font-bold text-urgent flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Low-Confidence Priority
            </span>
            <p className="text-2xl font-black text-urgent mt-1">{lowConfidenceCount}</p>
          </div>
          <div className="p-4 rounded-2xl border border-line bg-surface shadow-xs">
            <span className="text-xs font-semibold text-muted">Pending Review</span>
            <p className="text-2xl font-black text-ink mt-1">{pendingCount}</p>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-4 rounded-2xl border border-line bg-surface shadow-xs space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by patient name, complaint, or case #..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-line bg-surface text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted/60"
              />
            </div>

            {/* Level Filter */}
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              aria-label="Filter by triage level"
              className="px-3 py-2 rounded-xl border border-line bg-surface text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="All">All Triage Tiers</option>
              <option value="Emergency">Emergency Only</option>
              <option value="Urgent">Urgent Only</option>
              <option value="Routine">Routine Only</option>
              <option value="Self-Care Info">Self-Care Only</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter by status"
              className="px-3 py-2 rounded-xl border border-line bg-surface text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="All">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="reviewed">Reviewed</option>
            </select>

            {/* Confidence Filter */}
            <select
              value={filterConfidence}
              onChange={(e) => setFilterConfidence(e.target.value)}
              aria-label="Filter by AI confidence"
              className="px-3 py-2 rounded-xl border border-line bg-surface text-xs font-medium text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="All">All Confidence Levels</option>
              <option value="Low">Low Confidence Bumped</option>
              <option value="Medium">Medium Confidence</option>
              <option value="High">High Confidence</option>
            </select>
          </div>

          {/* Keyboard shortcut hint banner */}
          <div className="pt-2 border-t border-line/60 flex items-center justify-between text-[11px] text-muted">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-mono">
                <kbd className="px-1.5 py-0.5 rounded border border-line bg-bg text-ink">j</kbd>/
                <kbd className="px-1.5 py-0.5 rounded border border-line bg-bg text-ink">k</kbd> navigate
              </span>
              <span className="flex items-center gap-1 font-mono">
                <kbd className="px-1.5 py-0.5 rounded border border-line bg-bg text-ink">o</kbd> open case
              </span>
              <span className="flex items-center gap-1 font-mono">
                <kbd className="px-1.5 py-0.5 rounded border border-line bg-bg text-ink">r</kbd> mark reviewed
              </span>
            </div>
            <span>Showing {processedQueue.length} of {queue.length} cases</span>
          </div>
        </div>

        {/* Priority Queue Table */}
        <div className="rounded-2xl border border-line bg-surface shadow-xs overflow-hidden">
          {loading && queue.length === 0 ? (
            <div className="py-20 text-center text-muted">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm">Loading priority queue...</p>
            </div>
          ) : processedQueue.length === 0 ? (
            <div className="py-20 text-center text-muted">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-selfcare/80" />
              <p className="text-sm font-bold text-ink">No cases match the current filter criteria</p>
              <p className="text-xs text-muted mt-1">Adjust your search or filter settings to view more cases</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line bg-bg text-muted font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Priority / Case</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Chief Complaint</th>
                    <th className="py-3 px-4">Triage Tier</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {processedQueue.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    const isEmergency = item.is_emergency_flag || item.triage_level.toLowerCase() === 'emergency';
                    const isLowConf = item.confidence_band === 'Low';
                    const isReviewed = item.status === 'reviewed';

                    return (
                      <tr
                        key={item.id}
                        id={`queue-row-${item.id}`}
                        onClick={() => setSelectedIndex(idx)}
                        onDoubleClick={() => router.push(`/dashboard/clinician/cases/${item.id}`)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary-soft/60 ring-2 ring-primary/80 ring-inset'
                            : isEmergency
                            ? 'bg-emergency/5 hover:bg-emergency/10'
                            : isLowConf
                            ? 'bg-urgent/5 hover:bg-urgent/10'
                            : 'hover:bg-bg/60'
                        }`}
                      >
                        {/* Case ID & Indicator */}
                        <td className="py-3.5 px-4 font-mono font-bold text-ink">
                          <div className="flex items-center gap-2">
                            {isEmergency ? (
                              <span className="w-2 h-2 rounded-full bg-emergency animate-pulse" />
                            ) : isLowConf ? (
                              <span className="w-2 h-2 rounded-full bg-urgent" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-line" />
                            )}
                            <span>#{item.id}</span>
                          </div>
                        </td>

                        {/* Patient Demographics */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-ink">{item.patient_name}</p>
                          <p className="text-[11px] text-muted">
                            {item.patient_age}y • {item.patient_sex}
                          </p>
                        </td>

                        {/* Chief Complaint */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="font-medium text-ink truncate" title={item.chief_complaint}>
                            {item.chief_complaint}
                          </p>
                          <span className="text-[10px] text-muted">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        {/* Triage Tier Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isEmergency
                                ? 'bg-emergency text-surface'
                                : item.triage_level.toLowerCase().includes('urgent')
                                ? 'bg-urgent text-surface'
                                : item.triage_level.toLowerCase().includes('routine')
                                ? 'bg-routine text-surface'
                                : 'bg-selfcare text-surface'
                            }`}
                          >
                            {isEmergency && <AlertOctagon className="w-3.5 h-3.5" />}
                            {item.triage_level}
                          </span>
                        </td>

                        {/* Confidence Band */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <ConfidenceBadge band={item.confidence_band || 'MEDIUM'} />
                            {isLowConf && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-urgent/10 text-urgent border border-urgent/20">
                                Bumped
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                              isReviewed
                                ? 'bg-selfcare/10 text-selfcare border border-selfcare/20'
                                : 'bg-line text-muted'
                            }`}
                          >
                            {isReviewed ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-selfcare" /> Reviewed
                              </>
                            ) : (
                              'Pending'
                            )}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCaseReviewed(item.id, item.status);
                              }}
                              disabled={updatingStatusId === item.id}
                              className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                                isReviewed
                                  ? 'border-line text-muted hover:bg-line/40'
                                  : 'border-primary/30 text-primary bg-primary-soft hover:bg-primary hover:text-surface'
                              }`}
                              title={isReviewed ? 'Unmark reviewed (r)' : 'Mark reviewed (r)'}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/clinician/cases/${item.id}`);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-line bg-surface hover:bg-line text-ink font-bold text-xs flex items-center gap-1 transition-colors"
                              title="Open case workspace (o)"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3 text-muted" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Shift Digest Modal */}
      <ShiftDigestModal isOpen={digestOpen} onClose={() => setDigestOpen(false)} />
    </ClinicianLayout>
  );
}

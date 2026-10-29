'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Plus, 
  Eye, 
  Lock, 
  Clock, 
  FileWarning, 
  ShieldCheck 
} from 'lucide-react';

interface SecurityIncident {
  id: number;
  incident_code: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'INVESTIGATING' | 'CONTAINED' | 'REMEDIATED' | 'CLOSED';
  description: string;
  affected_accounts_count?: number;
  remediation_notes?: string;
  created_at?: string;
}

interface BreakGlassEntry {
  id: number;
  case_id: number | string;
  actor_id: number;
  reason: string;
  duration_minutes: number;
  expires_at?: string;
  created_at?: string;
  actor_email?: string;
}

export default function SecurityIncidentsManager() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [breakGlassEntries, setBreakGlassEntries] = useState<BreakGlassEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'incidents' | 'break-glass'>('incidents');

  // New incident modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newSeverity, setNewSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newAffectedCount, setNewAffectedCount] = useState<number>(0);
  const [newIncidentCode, setNewIncidentCode] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Status update modal
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('CONTAINED');
  const [remediationNotes, setRemediationNotes] = useState<string>('');
  const [updating, setUpdating] = useState<boolean>(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [incData, bgData]: any = await Promise.all([
        apiClient.fetch('/api/v1/admin/audit/incidents', 'get').catch(() => ({ incidents: [] })),
        apiClient.fetch('/api/v1/admin/audit/reports/break-glass', 'get').catch(() => ({ break_glass_events: [] })),
      ]);

      setIncidents(incData.incidents || incData || []);
      setBreakGlassEntries(bgData.break_glass_events || bgData || []);
    } catch (err: unknown) {
      console.error('Error fetching security incident data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    setSubmitting(true);
    try {
      await apiClient.fetch('/api/v1/admin/audit/incidents', 'post', {
        body: {
          title: newTitle.trim(),
          severity: newSeverity,
          description: newDescription.trim(),
          affected_accounts_count: Number(newAffectedCount) || 0,
          incident_code: newIncidentCode.trim() || `INC-${Date.now().toString().slice(-6)}`,
        },
      });

      setMessage({ type: 'success', text: 'Security incident logged successfully.' });
      setShowAddModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewAffectedCount(0);
      setNewIncidentCode('');
      await fetchData(true);
    } catch (err: any) {
      const msg = err.data?.detail || err.message || 'Error recording incident';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;

    setUpdating(true);
    try {
      await apiClient.fetch('/api/v1/admin/audit/incidents/{incident_id}', 'patch', {
        pathParams: { incident_id: selectedIncident.id },
        body: {
          status: updateStatus,
          remediation_notes: remediationNotes.trim(),
        },
      });

      setMessage({ type: 'success', text: `Incident #${selectedIncident.id} updated to ${updateStatus}.` });
      setSelectedIncident(null);
      setRemediationNotes('');
      await fetchData(true);
    } catch (err: any) {
      const msg = err.data?.detail || err.message || 'Error updating incident';
      setMessage({ type: 'error', text: msg });
    } finally {
      setUpdating(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-[hsl(var(--emergency)/0.15)] text-[hsl(var(--emergency))] border-[hsl(var(--emergency)/0.3)]';
      case 'HIGH':
        return 'bg-[hsl(var(--urgent)/0.15)] text-[hsl(var(--urgent))] border-[hsl(var(--urgent)/0.3)]';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'LOW':
      default:
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st.toUpperCase()) {
      case 'CLOSED':
      case 'REMEDIATED':
        return 'bg-selfcare/10 text-selfcare border-selfcare/20';
      case 'CONTAINED':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'INVESTIGATING':
      default:
        return 'bg-[hsl(var(--urgent)/0.15)] text-[hsl(var(--urgent))] border-[hsl(var(--urgent)/0.3)]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('incidents')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeSubTab === 'incidents'
                ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                : 'text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))]'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Security Incidents ({incidents.length})
          </button>
          <button
            onClick={() => setActiveSubTab('break-glass')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeSubTab === 'break-glass'
                ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                : 'text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))]'
            }`}
          >
            <Lock className="w-4 h-4" />
            Break-Glass Audits ({breakGlassEntries.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs font-medium text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))] transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {activeSubTab === 'incidents' && (
            <button
              id="record-new-incident-btn"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[hsl(var(--emergency))] text-white text-xs font-semibold hover:opacity-90 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Report Incident
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center justify-between border ${
          message.type === 'success'
            ? 'bg-selfcare/10 border-selfcare/30 text-selfcare'
            : 'bg-[hsl(var(--emergency)/0.1)] border-[hsl(var(--emergency)/0.3)] text-[hsl(var(--emergency))]'
        }`}>
          <div className="flex items-center gap-2 text-xs font-medium">
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs underline hover:opacity-75">
            Dismiss
          </button>
        </div>
      )}

      {/* Security Incidents Table */}
      {activeSubTab === 'incidents' && (
        <div className="rounded-2xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[hsl(var(--muted))] gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
              <span className="text-xs">Loading recorded incidents...</span>
            </div>
          ) : incidents.length === 0 ? (
            <div className="py-12 text-center text-sm text-[hsl(var(--muted))]">
              No security incidents recorded. System security posture is optimal.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[hsl(var(--line))] text-[hsl(var(--muted))] font-medium bg-[hsl(var(--bg)/0.5)]">
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Affected Accounts</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--line))]">
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-[hsl(var(--surface-hover))] transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-[hsl(var(--primary))]">
                        {inc.incident_code}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(inc.severity)}`}>
                          {inc.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[hsl(var(--ink))]">
                        {inc.title}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(inc.status)}`}>
                          {inc.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[hsl(var(--ink))]">
                        {inc.affected_accounts_count ?? 0}
                      </td>
                      <td className="py-2.5 px-3 text-[hsl(var(--muted))] whitespace-nowrap">
                        {inc.created_at ? new Date(inc.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedIncident(inc);
                            setUpdateStatus(inc.status);
                            setRemediationNotes(inc.remediation_notes || '');
                          }}
                          className="px-2.5 py-1 rounded-lg border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs font-medium text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))] transition"
                        >
                          Update Status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Break-Glass Audits Table */}
      {activeSubTab === 'break-glass' && (
        <div className="rounded-2xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[hsl(var(--muted))] gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
              <span className="text-xs">Loading break-glass event trail...</span>
            </div>
          ) : breakGlassEntries.length === 0 ? (
            <div className="py-12 text-center text-sm text-[hsl(var(--muted))]">
              No emergency break-glass revelations logged.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[hsl(var(--line))] text-[hsl(var(--muted))] font-medium bg-[hsl(var(--bg)/0.5)]">
                    <th className="py-2.5 px-3">Event ID</th>
                    <th className="py-2.5 px-3">Case ID</th>
                    <th className="py-2.5 px-3">Actor ID</th>
                    <th className="py-2.5 px-3">Clinical Justification</th>
                    <th className="py-2.5 px-3">TTL</th>
                    <th className="py-2.5 px-3">Revealed At</th>
                    <th className="py-2.5 px-3">Expires At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--line))]">
                  {breakGlassEntries.map((bg) => (
                    <tr key={bg.id} className="hover:bg-[hsl(var(--surface-hover))] transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-[hsl(var(--emergency))]">
                        #{bg.id}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[hsl(var(--ink))]">
                        Case #{bg.case_id}
                      </td>
                      <td className="py-2.5 px-3 text-[hsl(var(--muted))]">
                        User #{bg.actor_id}
                      </td>
                      <td className="py-2.5 px-3 text-[hsl(var(--ink))] max-w-xs truncate">
                        {bg.reason}
                      </td>
                      <td className="py-2.5 px-3 text-[hsl(var(--muted))]">
                        {bg.duration_minutes}m
                      </td>
                      <td className="py-2.5 px-3 text-[hsl(var(--muted))] whitespace-nowrap">
                        {bg.created_at ? new Date(bg.created_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-[hsl(var(--muted))] whitespace-nowrap">
                        {bg.expires_at ? new Date(bg.expires_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Incident Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[hsl(var(--emergency)/0.1)] text-[hsl(var(--emergency))]">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[hsl(var(--ink))]">Log Security Incident</h3>
                <p className="text-xs text-[hsl(var(--muted))]">Record a security event or breach notification</p>
              </div>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[hsl(var(--ink))] mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unauthorized credential probe on edge gateway"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[hsl(var(--ink))] mb-1">Severity *</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[hsl(var(--ink))] mb-1">Affected Accounts</label>
                  <input
                    type="number"
                    min="0"
                    value={newAffectedCount}
                    onChange={(e) => setNewAffectedCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[hsl(var(--ink))] mb-1">Incident Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SEC-2026-004"
                  value={newIncidentCode}
                  onChange={(e) => setNewIncidentCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-[hsl(var(--ink))] font-mono focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[hsl(var(--ink))] mb-1">Detailed Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the nature of the event, vectors, and observed anomalies..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                  className="px-3.5 py-1.5 rounded-xl border border-[hsl(var(--line))] text-xs font-medium text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))] transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-[hsl(var(--emergency))] text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Submit Incident Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[hsl(var(--ink))]">
                  Update {selectedIncident.incident_code}
                </h3>
                <p className="text-xs text-[hsl(var(--muted))]">{selectedIncident.title}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[hsl(var(--ink))] mb-1">New Status *</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                >
                  <option value="INVESTIGATING">INVESTIGATING</option>
                  <option value="CONTAINED">CONTAINED</option>
                  <option value="REMEDIATED">REMEDIATED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[hsl(var(--ink))] mb-1">Remediation Notes</label>
                <textarea
                  rows={3}
                  placeholder="Actions taken to isolate, patch, or resolve this incident..."
                  value={remediationNotes}
                  onChange={(e) => setRemediationNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  disabled={updating}
                  className="px-3.5 py-1.5 rounded-xl border border-[hsl(var(--line))] text-xs font-medium text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))] transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-1.5 rounded-xl bg-[hsl(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {updating && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState } from "react";
import { Search, ShieldAlert, Filter, AlertTriangle, RefreshCw } from "lucide-react";

export function MetadataSearch() {
  const [caseId, setCaseId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [triageLevel, setTriageLevel] = useState("");
  const [status, setStatus] = useState("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);

  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data: any = await apiClient.fetch("/api/v1/admin/cases/metadata-search", "get", {
        params: {
          case_id: caseId.trim() ? parseInt(caseId.trim(), 10) : undefined,
          patient_id: patientId.trim() ? parseInt(patientId.trim(), 10) : undefined,
          triage_level: triageLevel || undefined,
          status: status || undefined,
          is_emergency_flag: emergencyOnly ? true : undefined,
        },
      });
      setResults(data.cases || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to execute metadata search.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Zero-PHI Security Notice */}
      <div className="p-3.5 rounded-xl border border-primary/30 bg-primary-soft/10 text-xs text-ink flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p>
          <strong className="font-semibold text-primary">Zero-PHI Statutory Privacy Protocol:</strong> This interface returns strictly approved technical metadata. Chief complaints, clinical narratives, symptoms, and identifiable patient names are cryptographically redacted at the query projection layer.
        </p>
      </div>

      {/* Search Filter Form */}
      <form onSubmit={handleSearch} className="rounded-card border border-line bg-surface p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-ink font-medium mb-1">Case ID:</label>
            <input
              type="number"
              placeholder="e.g. 1024"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-ink"
            />
          </div>

          <div>
            <label className="block text-ink font-medium mb-1">Patient ID (Opaque):</label>
            <input
              type="number"
              placeholder="e.g. 42"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-ink"
            />
          </div>

          <div>
            <label className="block text-ink font-medium mb-1">Triage Level:</label>
            <select
              value={triageLevel}
              onChange={(e) => setTriageLevel(e.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
            >
              <option value="">All Triage Levels</option>
              <option value="Emergency">Emergency</option>
              <option value="Urgent">Urgent</option>
              <option value="Routine">Routine</option>
              <option value="Self-Care Info">Self-Care Info</option>
            </select>
          </div>

          <div>
            <label className="block text-ink font-medium mb-1">Case Status:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
            >
              <option value="">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
              <option value="archived">Archived</option>
              <option value="soft_deleted">Soft Deleted</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-line text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-ink">
            <input
              type="checkbox"
              checked={emergencyOnly}
              onChange={(e) => setEmergencyOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-line text-primary focus:ring-primary"
            />
            <span>Emergency Flagged Only</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary-dark transition-all shadow-xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{loading ? "Searching..." : "Search Metadata"}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="p-3.5 rounded-lg border border-emergency/30 bg-emergency/5 text-xs text-emergency">
          {error}
        </div>
      )}

      {/* Results Table */}
      {hasSearched && (
        <div className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
          <div className="p-3 bg-bg/50 border-b border-line flex items-center justify-between text-xs">
            <span className="font-heading font-semibold text-ink uppercase tracking-wider">
              Search Results ({total} matches)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg/70 border-b border-line text-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Case ID</th>
                  <th className="p-3">Patient Ref</th>
                  <th className="p-3">Created Timestamp</th>
                  <th className="p-3">Triage Level</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Emergency</th>
                  <th className="p-3">Assigned Clinician</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted">
                      No cases matched search filters.
                    </td>
                  </tr>
                ) : (
                  results.map((c) => (
                    <tr key={c.id} className="hover:bg-bg/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-ink">#{c.id}</td>
                      <td className="p-3 font-mono text-muted">User #{c.patient_id}</td>
                      <td className="p-3 font-mono text-muted text-[11px]">
                        {new Date(c.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-bg border border-line font-mono">
                          {c.triage_level}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px]">{c.status}</td>
                      <td className="p-3">
                        {c.is_emergency_flag ? (
                          <span className="text-emergency font-bold text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> YES
                          </span>
                        ) : (
                          <span className="text-muted text-[11px]">No</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-muted">
                        {c.assigned_clinician_id ? `Dr. #${c.assigned_clinician_id}` : "Unassigned"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

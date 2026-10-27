'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { 
  History, 
  Search, 
  Filter, 
  RefreshCw, 
  ExternalLink, 
  Eye, 
  Lock, 
  Calendar, 
  Clock, 
  User, 
  ArrowRight, 
  Copy, 
  Check 
} from 'lucide-react';

interface AuditRecord {
  id: number;
  actor_id: number;
  action_code?: string;
  action?: string;
  target_type: string;
  target_id?: string | number | null;
  reason?: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  prev_hash?: string | null;
  entry_hash?: string | null;
  created_at?: string;
  actor_email?: string;
  actor_role?: string;
}

interface AuditExplorerTableProps {
  onSelectRecord?: (record: AuditRecord) => void;
}

export default function AuditExplorerTable({ onSelectRecord }: AuditExplorerTableProps) {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Filters
  const [actionFilter, setActionFilter] = useState<string>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('ALL');
  const [actorIdFilter, setActorIdFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const limit = 25;

  // Selected record for modal inspection
  const [inspectRecord, setInspectRecord] = useState<AuditRecord | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchRecords = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data: any = await apiClient.fetch('/api/v1/admin/audit/explorer', 'get', {
        params: {
          action: actionFilter || undefined,
          target_type: targetTypeFilter !== 'ALL' ? targetTypeFilter : undefined,
          actor_id: actorIdFilter ? parseInt(actorIdFilter, 10) : undefined,
          limit,
          offset: (page - 1) * limit,
        },
      });

      setRecords(data.records || data.items || data || []);
      setTotalCount(data.total ?? (data.records ? data.records.length : 0));
    } catch (err: unknown) {
      console.error('Audit query error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actionFilter, targetTypeFilter, actorIdFilter, page, limit]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(type);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const getActionBadgeColor = (action: string) => {
    const act = (action || '').toLowerCase();
    if (act.includes('delete') || act.includes('kill') || act.includes('revoke')) {
      return 'bg-[hsl(var(--emergency)/0.15)] text-[hsl(var(--emergency))] border-[hsl(var(--emergency)/0.3)]';
    }
    if (act.includes('unlock') || act.includes('override') || act.includes('break_glass')) {
      return 'bg-[hsl(var(--urgent)/0.15)] text-[hsl(var(--urgent))] border-[hsl(var(--urgent)/0.3)]';
    }
    if (act.includes('publish') || act.includes('approve')) {
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
    return 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border-[hsl(var(--primary)/0.2)]';
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted))]" />
          <input
            id="audit-search-action-input"
            type="text"
            placeholder="Search action code (e.g. CLINICAL_RULES_PUBLISH, USER_ROLE_ASSIGN)..."
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-[hsl(var(--muted))]">Target:</span>
          <select
            id="audit-target-type-select"
            value={targetTypeFilter}
            onChange={(e) => {
              setTargetTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          >
            <option value="ALL">All Targets</option>
            <option value="user">User</option>
            <option value="role">Role</option>
            <option value="clinical_rule">Clinical Rule</option>
            <option value="quality_parameter">Quality Parameter</option>
            <option value="ai_config">AI Config</option>
            <option value="consent_version">Consent Version</option>
            <option value="rate_limit">Rate Limit</option>
            <option value="incident">Incident</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-[hsl(var(--muted))]">Actor ID:</span>
          <input
            type="number"
            placeholder="User ID"
            value={actorIdFilter}
            onChange={(e) => {
              setActorIdFilter(e.target.value);
              setPage(1);
            }}
            className="w-20 px-2 py-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </div>

        <button
          id="refresh-audit-table-btn"
          onClick={() => fetchRecords(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs font-medium text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))] transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] overflow-hidden shadow-sm">
        {loading && records.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-[hsl(var(--muted))] gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
            <span className="text-xs">Querying cryptographic audit explorer...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted))]">
            No audit records match the current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[hsl(var(--line))] text-[hsl(var(--muted))] font-medium bg-[hsl(var(--bg)/0.5)]">
                  <th className="py-3 px-3">ID</th>
                  <th className="py-3 px-3">Timestamp (UTC)</th>
                  <th className="py-3 px-3">Actor</th>
                  <th className="py-3 px-3">Action Code</th>
                  <th className="py-3 px-3">Target</th>
                  <th className="py-3 px-3">Reason / Justification</th>
                  <th className="py-3 px-3 font-mono">Chain Hash</th>
                  <th className="py-3 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--line))]">
                {records.map((r) => {
                  const actionName = r.action_code || r.action || 'UNKNOWN_ACTION';
                  return (
                    <tr 
                      key={r.id} 
                      className="hover:bg-[hsl(var(--surface-hover))] transition cursor-pointer"
                      onClick={() => setInspectRecord(r)}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-[hsl(var(--ink))]">
                        #{r.id}
                      </td>
                      <td className="py-2.5 px-3 text-[hsl(var(--muted))] whitespace-nowrap">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[hsl(var(--ink))] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-[hsl(var(--muted))]" />
                          <span>User #{r.actor_id}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadgeColor(actionName)}`}>
                          {actionName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[hsl(var(--ink))]">
                        <span className="font-semibold">{r.target_type}</span>
                        {r.target_id && <span className="text-[hsl(var(--muted))] ml-1">({r.target_id})</span>}
                      </td>
                      <td className="py-2.5 px-3 text-[hsl(var(--ink))] max-w-xs truncate">
                        {r.reason || <span className="text-[hsl(var(--muted))] italic">None provided</span>}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-[hsl(var(--muted))] max-w-[120px] truncate">
                        {r.entry_hash ? `${r.entry_hash.slice(0, 10)}...` : 'genesis'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectRecord(r);
                          }}
                          className="p-1 rounded-lg border border-[hsl(var(--line))] hover:bg-[hsl(var(--primary)/0.1)] hover:text-[hsl(var(--primary))] transition"
                          title="View Full Ledger Entry"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        <div className="p-3 border-t border-[hsl(var(--line))] flex items-center justify-between text-xs text-[hsl(var(--muted))]">
          <span>Showing page {page}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded-lg border border-[hsl(var(--line))] bg-[hsl(var(--bg))] hover:bg-[hsl(var(--surface-hover))] disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={records.length < limit}
              className="px-2.5 py-1 rounded-lg border border-[hsl(var(--line))] bg-[hsl(var(--bg))] hover:bg-[hsl(var(--surface-hover))] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Record Inspection Modal */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col p-6 rounded-3xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[hsl(var(--line))] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[hsl(var(--primary))]">
                    Entry #{inspectRecord.id}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadgeColor(inspectRecord.action_code || inspectRecord.action || '')}`}>
                    {inspectRecord.action_code || inspectRecord.action}
                  </span>
                </div>
                <p className="text-xs text-[hsl(var(--muted))] mt-1">
                  Recorded on {inspectRecord.created_at ? new Date(inspectRecord.created_at).toLocaleString() : 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setInspectRecord(null)}
                className="p-1 rounded-lg hover:bg-[hsl(var(--surface-hover))] text-xs text-[hsl(var(--muted))] font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {/* Actor & Target Info */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[hsl(var(--bg))] border border-[hsl(var(--line))]">
                <div>
                  <span className="text-[hsl(var(--muted))]">Actor ID:</span>
                  <p className="font-semibold text-[hsl(var(--ink))]">#{inspectRecord.actor_id}</p>
                </div>
                <div>
                  <span className="text-[hsl(var(--muted))]">Target Reference:</span>
                  <p className="font-semibold text-[hsl(var(--ink))]">
                    {inspectRecord.target_type} {inspectRecord.target_id ? `(${inspectRecord.target_id})` : ''}
                  </p>
                </div>
              </div>

              {/* Justification */}
              <div>
                <span className="font-semibold text-[hsl(var(--ink))]">Reason / Justification:</span>
                <p className="p-3 rounded-xl bg-[hsl(var(--bg))] border border-[hsl(var(--line))] text-[hsl(var(--ink))] mt-1">
                  {inspectRecord.reason || 'None provided'}
                </p>
              </div>

              {/* Cryptographic Link Proof */}
              <div className="p-3 rounded-xl bg-[hsl(var(--bg))] border border-[hsl(var(--line))] space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-[hsl(var(--ink))]">
                  <Lock className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                  <span>Cryptographic Proof Links (SHA-256)</span>
                </div>
                
                <div>
                  <div className="flex items-center justify-between text-[11px] text-[hsl(var(--muted))]">
                    <span>Previous Entry Hash:</span>
                    <button
                      onClick={() => inspectRecord.prev_hash && copyToClipboard(inspectRecord.prev_hash, 'prev')}
                      className="flex items-center gap-1 text-[hsl(var(--primary))] hover:underline"
                    >
                      {copiedHash === 'prev' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      Copy
                    </button>
                  </div>
                  <code className="block p-1.5 mt-0.5 rounded bg-[hsl(var(--surface))] font-mono text-[10px] break-all border border-[hsl(var(--line))]">
                    {inspectRecord.prev_hash || '0'.repeat(64) + ' (genesis block)'}
                  </code>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-[hsl(var(--muted))]">
                    <span>This Entry Hash:</span>
                    <button
                      onClick={() => inspectRecord.entry_hash && copyToClipboard(inspectRecord.entry_hash, 'entry')}
                      className="flex items-center gap-1 text-[hsl(var(--primary))] hover:underline"
                    >
                      {copiedHash === 'entry' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      Copy
                    </button>
                  </div>
                  <code className="block p-1.5 mt-0.5 rounded bg-[hsl(var(--surface))] font-mono text-[10px] break-all border border-[hsl(var(--line))] text-[hsl(var(--primary))]">
                    {inspectRecord.entry_hash || 'N/A'}
                  </code>
                </div>
              </div>

              {/* State Diffs */}
              <div className="space-y-2">
                <span className="font-semibold text-[hsl(var(--ink))]">Recorded Mutation State (Diff):</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-[hsl(var(--bg))] border border-[hsl(var(--line))] overflow-x-auto">
                    <span className="font-bold text-[hsl(var(--muted))] block mb-1">Before State:</span>
                    <pre className="font-mono text-[10px] text-[hsl(var(--ink))]">
                      {inspectRecord.before_state ? JSON.stringify(inspectRecord.before_state, null, 2) : 'null'}
                    </pre>
                  </div>

                  <div className="p-3 rounded-xl bg-[hsl(var(--bg))] border border-[hsl(var(--line))] overflow-x-auto">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1">After State:</span>
                    <pre className="font-mono text-[10px] text-[hsl(var(--ink))]">
                      {inspectRecord.after_state ? JSON.stringify(inspectRecord.after_state, null, 2) : 'null'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-[hsl(var(--line))]">
              <button
                onClick={() => setInspectRecord(null)}
                className="px-4 py-1.5 rounded-xl bg-[hsl(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

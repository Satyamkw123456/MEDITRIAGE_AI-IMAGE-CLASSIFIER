'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { 
  ShieldAlert, 
  Ban, 
  CheckCircle, 
  RefreshCw, 
  AlertTriangle, 
  Plus, 
  Search, 
  Clock 
} from 'lucide-react';

interface IPBlockEntry {
  ip: string;
  reason: string;
  blocked_at?: string;
  blocked_by?: string;
}

interface RateLimitsConfig {
  global_per_minute?: number;
  per_ip_per_minute?: number;
  burst_allowance?: number;
  blocklist?: IPBlockEntry[];
  whitelisted_ranges?: string[];
  [key: string]: unknown;
}

export default function RateLimitsEditor() {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [config, setConfig] = useState<RateLimitsConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add block modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [blockIp, setBlockIp] = useState<string>('');
  const [blockReason, setBlockReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Unblock confirmation state
  const [unblockingIp, setUnblockingIp] = useState<string | null>(null);

  const fetchRateLimits = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data: any = await apiClient.fetch('/api/v1/admin/operations/rate-limits', 'get');
      setConfig(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching rate limits';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRateLimits();
  }, []);

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockIp.trim() || !blockReason.trim()) {
      setStatusMessage({ type: 'error', text: 'IP address and reason are required' });
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.fetch('/api/v1/admin/operations/rate-limits/block-ip', 'post', {
        body: {
          ip: blockIp.trim(),
          reason: blockReason.trim(),
        },
      });

      setStatusMessage({ type: 'success', text: `IP ${blockIp} added to active blocklist.` });
      setShowAddModal(false);
      setBlockIp('');
      setBlockReason('');
      await fetchRateLimits(true);
    } catch (err: any) {
      const msg = err.data?.detail || err.message || 'Error blocking IP';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnblock = async (ip: string) => {
    setSubmitting(true);
    try {
      await apiClient.fetch('/api/v1/admin/operations/rate-limits/unblock-ip', 'post', {
        params: { ip },
      });

      setStatusMessage({ type: 'success', text: `IP ${ip} removed from blocklist.` });
      setUnblockingIp(null);
      await fetchRateLimits(true);
    } catch (err: any) {
      const msg = err.data?.detail || err.message || 'Error unblocking IP';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const blocklist = config?.blocklist || [];
  const filteredBlocklist = blocklist.filter((entry) => 
    entry.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[hsl(var(--ink))]">Rate Limits &amp; IP Blocklist</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/0.2)]">
              Edge Filter
            </span>
          </div>
          <p className="text-sm text-[hsl(var(--muted))] mt-1">
            Configure global API throttles and enforce immediate IP-level bans for abusive traffic.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="refresh-rate-limits-btn"
            onClick={() => fetchRateLimits(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs font-medium text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))] transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            id="add-ip-block-modal-btn"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[hsl(var(--emergency))] text-white text-xs font-semibold shadow hover:opacity-90 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Block IP Address
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl flex items-center justify-between border ${
          statusMessage.type === 'success' 
            ? 'bg-selfcare/10 border-selfcare/30 text-selfcare' 
            : 'bg-[hsl(var(--emergency)/0.1)] border-[hsl(var(--emergency)/0.3)] text-[hsl(var(--emergency))]'
        }`}>
          <div className="flex items-center gap-2 text-sm font-medium">
            {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs underline hover:opacity-75">
            Dismiss
          </button>
        </div>
      )}

      {/* Global Rate Limits Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))]">
          <span className="text-xs font-medium text-[hsl(var(--muted))] uppercase tracking-wider">Per-IP Throttle</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[hsl(var(--ink))]">
              {config?.per_ip_per_minute ?? 60}
            </span>
            <span className="text-xs text-[hsl(var(--muted))]">req / min</span>
          </div>
          <p className="text-xs text-[hsl(var(--muted))] mt-1">Applies to unauthenticated &amp; public triage endpoints</p>
        </div>

        <div className="p-4 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))]">
          <span className="text-xs font-medium text-[hsl(var(--muted))] uppercase tracking-wider">Global Aggregate Limit</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[hsl(var(--ink))]">
              {config?.global_per_minute ?? 5000}
            </span>
            <span className="text-xs text-[hsl(var(--muted))]">req / min</span>
          </div>
          <p className="text-xs text-[hsl(var(--muted))] mt-1">Total API ingress capacity threshold before 429 shedding</p>
        </div>

        <div className="p-4 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))]">
          <span className="text-xs font-medium text-[hsl(var(--muted))] uppercase tracking-wider">Active IP Blocks</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[hsl(var(--emergency))]">
              {blocklist.length}
            </span>
            <span className="text-xs text-[hsl(var(--muted))]">addresses</span>
          </div>
          <p className="text-xs text-[hsl(var(--muted))] mt-1">Immediate TCP/HTTP drop enforced at edge gateway</p>
        </div>
      </div>

      {/* Blocklist Table */}
      <div className="p-5 rounded-2xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-[hsl(var(--emergency))]" />
            <h3 className="text-base font-bold text-[hsl(var(--ink))]">Enforced IP Blocklist</h3>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted))]" />
            <input
              type="text"
              placeholder="Search IP or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-[hsl(var(--muted))] gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
            <span className="text-xs">Loading rate limits and active blocklist...</span>
          </div>
        ) : filteredBlocklist.length === 0 ? (
          <div className="py-10 text-center text-sm text-[hsl(var(--muted))] border border-dashed border-[hsl(var(--line))] rounded-xl">
            {searchQuery ? 'No blocked IPs matching your query.' : 'No IPs currently blocked. System ingress is operating normally.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[hsl(var(--line))] text-[hsl(var(--muted))] font-medium">
                  <th className="py-2.5 px-3">IP Address</th>
                  <th className="py-2.5 px-3">Reason / Justification</th>
                  <th className="py-2.5 px-3">Blocked At</th>
                  <th className="py-2.5 px-3">Blocked By</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--line))]">
                {filteredBlocklist.map((entry) => (
                  <tr key={entry.ip} className="hover:bg-[hsl(var(--surface-hover))] transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-[hsl(var(--emergency))]">
                      {entry.ip}
                    </td>
                    <td className="py-2.5 px-3 text-[hsl(var(--ink))] max-w-xs truncate">
                      {entry.reason}
                    </td>
                    <td className="py-2.5 px-3 text-[hsl(var(--muted))] whitespace-nowrap">
                      {entry.blocked_at ? new Date(entry.blocked_at).toLocaleString() : 'System default'}
                    </td>
                    <td className="py-2.5 px-3 text-[hsl(var(--muted))] whitespace-nowrap">
                      {entry.blocked_by || 'Admin'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => setUnblockingIp(entry.ip)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-[hsl(var(--ink))] border border-[hsl(var(--line))] bg-[hsl(var(--bg))] hover:bg-selfcare/10 hover:text-selfcare hover:border-selfcare/30 transition"
                      >
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add IP Block Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[hsl(var(--emergency)/0.1)] text-[hsl(var(--emergency))]">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[hsl(var(--ink))]">Block IP Address</h3>
                <p className="text-xs text-[hsl(var(--muted))]">Immediately reject all requests originating from this host</p>
              </div>
            </div>

            <form onSubmit={handleAddBlock} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--ink))] mb-1">
                  IP Address (IPv4 or IPv6) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 192.168.1.100 or 10.0.0.5"
                  value={blockIp}
                  onChange={(e) => setBlockIp(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs text-[hsl(var(--ink))] font-mono focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--ink))] mb-1">
                  Reason / Threat Category *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Repeated credential stuffing attempts on /auth endpoint"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                  className="px-3.5 py-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs font-medium text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))] transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-[hsl(var(--emergency))] text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Confirm IP Ban
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unblock Confirmation Modal */}
      {unblockingIp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-selfcare/10 text-selfcare">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[hsl(var(--ink))]">Confirm Unblock</h3>
                <p className="text-xs text-[hsl(var(--muted))]">Restore network access for this IP</p>
              </div>
            </div>

            <p className="text-xs text-[hsl(var(--ink))]">
              Are you sure you want to remove <span className="font-mono font-bold text-[hsl(var(--primary))]">{unblockingIp}</span> from the blocklist?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUnblockingIp(null)}
                disabled={submitting}
                className="px-3.5 py-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs font-medium text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))] transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUnblock(unblockingIp)}
                disabled={submitting}
                className="px-4 py-1.5 rounded-xl bg-selfcare text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                Confirm Unblock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

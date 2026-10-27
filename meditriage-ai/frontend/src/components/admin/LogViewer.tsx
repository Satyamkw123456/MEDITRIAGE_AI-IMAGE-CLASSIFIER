'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { 
  FileText, 
  RefreshCw, 
  ShieldCheck, 
  Filter, 
  Search, 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  ChevronDown 
} from 'lucide-react';

interface LogEntry {
  timestamp?: string;
  level: string;
  service: string;
  message: string;
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

export default function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  
  // Filter state
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedService, setSelectedService] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLogs = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data: any = await apiClient.fetch('/api/v1/admin/operations/logs', 'get', {
        params: {
          level: selectedLevel !== 'ALL' ? selectedLevel.toLowerCase() : undefined,
          service: selectedService !== 'ALL' ? selectedService.toLowerCase() : undefined,
          limit: 100,
        },
      });

      setLogs(data.logs || []);
      setErrorMsg(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching logs';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLevel, selectedService]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const toggleExpand = (idx: number) => {
    setExpandedIndices(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const matchMessage = (log.message || '').toLowerCase().includes(query);
    const matchService = (log.service || '').toLowerCase().includes(query);
    const matchLevel = (log.level || '').toLowerCase().includes(query);
    return matchMessage || matchService || matchLevel;
  });

  const getLevelBadgeClass = (level: string) => {
    const lvl = level.toUpperCase();
    switch (lvl) {
      case 'CRITICAL':
      case 'ERROR':
        return 'bg-[hsl(var(--emergency)/0.15)] text-[hsl(var(--emergency))] border border-[hsl(var(--emergency)/0.3)]';
      case 'WARNING':
      case 'WARN':
        return 'bg-[hsl(var(--urgent)/0.15)] text-[hsl(var(--urgent))] border border-[hsl(var(--urgent)/0.3)]';
      case 'INFO':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      case 'DEBUG':
      default:
        return 'bg-[hsl(var(--muted)/0.15)] text-[hsl(var(--muted))] border border-[hsl(var(--line))]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[hsl(var(--ink))]">Operational Log Stream</h2>
            <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero-PHI Certified</span>
            </div>
          </div>
          <p className="text-sm text-[hsl(var(--muted))] mt-1">
            Aggregated backend operational logs stripped of all patient health information, MRNs, and high-entropy secrets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[hsl(var(--muted))] cursor-pointer pr-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-[hsl(var(--line))] text-[hsl(var(--primary))] focus:ring-0"
            />
            Live Stream (5s)
          </label>
          <button
            id="refresh-logs-btn"
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs font-medium text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))] transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl flex items-center justify-between border bg-[hsl(var(--emergency)/0.1)] border-[hsl(var(--emergency)/0.3)] text-[hsl(var(--emergency))] text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs underline hover:opacity-75">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted))]" />
          <input
            type="text"
            placeholder="Search log messages, services, or events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted))]">
            <Filter className="w-3.5 h-3.5" />
            <span>Level:</span>
          </div>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          >
            <option value="ALL">All Levels</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="ERROR">ERROR</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
            <option value="DEBUG">DEBUG</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-[hsl(var(--muted))]">Service:</span>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          >
            <option value="ALL">All Services</option>
            <option value="api">API Server</option>
            <option value="triage_engine">Triage Engine</option>
            <option value="ai_guardrails">AI Guardrails</option>
            <option value="scheduler">Scheduler &amp; Cron</option>
            <option value="rag">RAG Engine</option>
            <option value="auth">Auth &amp; IAM</option>
          </select>
        </div>
      </div>

      {/* Log Feed */}
      <div className="rounded-2xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] overflow-hidden shadow-sm">
        {loading && logs.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-[hsl(var(--muted))] gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
            <span className="text-xs">Streaming logs from backend...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted))]">
            No log entries match the selected filters.
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--line))] font-mono text-xs">
            {filteredLogs.map((entry, idx) => {
              const isExpanded = !!expandedIndices[idx];
              const hasContext = entry.context && Object.keys(entry.context).length > 0;

              return (
                <div key={idx} className="p-3 hover:bg-[hsl(var(--surface-hover))] transition">
                  <div 
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
                    onClick={() => hasContext && toggleExpand(idx)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getLevelBadgeClass(entry.level)}`}>
                        {entry.level}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[hsl(var(--surface))] border border-[hsl(var(--line))] text-[10px] text-[hsl(var(--ink))] font-medium">
                        {entry.service}
                      </span>
                      <span className="text-[hsl(var(--ink))] break-all font-sans text-xs">
                        {entry.message}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[hsl(var(--muted))] shrink-0 text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : 'now'}</span>
                      </div>
                      {hasContext && (
                        <div className="text-[hsl(var(--primary))] flex items-center">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && hasContext && (
                    <div className="mt-2.5 p-3 rounded-xl bg-[hsl(var(--bg))] border border-[hsl(var(--line))] text-[11px] overflow-x-auto text-[hsl(var(--ink))]">
                      <pre className="font-mono text-[hsl(var(--muted))] whitespace-pre-wrap">
                        {JSON.stringify(entry.context, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

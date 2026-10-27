'use client';

import React, { useState } from 'react';
import { 
  Activity, 
  Calendar, 
  Database, 
  ShieldAlert, 
  Terminal, 
  Cpu 
} from 'lucide-react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { SystemHealthDashboard } from '@/components/admin/SystemHealthDashboard';
import { JobsMonitor } from '@/components/admin/JobsMonitor';
import { RAGCorpusManager } from '@/components/admin/RAGCorpusManager';
import RateLimitsEditor from '@/components/admin/RateLimitsEditor';
import LogViewer from '@/components/admin/LogViewer';

export default function AdminOperationsPage() {
  const [activeTab, setActiveTab] = useState<'health' | 'jobs' | 'rag' | 'rate-limits' | 'logs'>('health');

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="p-6 rounded-3xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--ink))]">Operations &amp; Infrastructure</h1>
              <p className="text-sm text-[hsl(var(--muted))] mt-1">
                Real-time subsystems telemetry, automated background cron jobs, RAG knowledge indexing, and perimeter edge controls.
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-6 overflow-x-auto border-b border-[hsl(var(--line))] pb-px">
            <button
              id="tab-health-btn"
              onClick={() => setActiveTab('health')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                activeTab === 'health'
                  ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                  : 'border-transparent text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))]'
              }`}
            >
              <Activity className="w-4 h-4" />
              System Health
            </button>

            <button
              id="tab-jobs-btn"
              onClick={() => setActiveTab('jobs')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                activeTab === 'jobs'
                  ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                  : 'border-transparent text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Background Jobs
            </button>

            <button
              id="tab-rag-btn"
              onClick={() => setActiveTab('rag')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                activeTab === 'rag'
                  ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                  : 'border-transparent text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))]'
              }`}
            >
              <Database className="w-4 h-4" />
              RAG Corpus
            </button>

            <button
              id="tab-rate-limits-btn"
              onClick={() => setActiveTab('rate-limits')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                activeTab === 'rate-limits'
                  ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                  : 'border-transparent text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))]'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Rate Limits &amp; IP Blocks
            </button>

            <button
              id="tab-logs-btn"
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                activeTab === 'logs'
                  ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                  : 'border-transparent text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))]'
              }`}
            >
              <Terminal className="w-4 h-4" />
              PHI-Free Logs
            </button>
          </div>
        </div>

        {/* Tab Panels */}
        <div>
          {activeTab === 'health' && <SystemHealthDashboard />}
          {activeTab === 'jobs' && <JobsMonitor />}
          {activeTab === 'rag' && <RAGCorpusManager />}
          {activeTab === 'rate-limits' && <RateLimitsEditor />}
          {activeTab === 'logs' && <LogViewer />}
        </div>
      </div>
    </AdminLayout>
  );
}

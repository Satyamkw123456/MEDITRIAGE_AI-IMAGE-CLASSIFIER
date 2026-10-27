'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  History, 
  FileCheck2, 
  AlertTriangle, 
  Download, 
  Lock, 
  CheckCircle2 
} from 'lucide-react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import AuditChainStatusBanner from '@/components/admin/AuditChainStatusBanner';
import AuditExplorerTable from '@/components/admin/AuditExplorerTable';
import AuditSignedExportModal from '@/components/admin/AuditSignedExportModal';
import SecurityIncidentsManager from '@/components/admin/SecurityIncidentsManager';

export default function AdminAuditPage() {
  const [activeTab, setActiveTab] = useState<'explorer' | 'incidents'>('explorer');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="p-6 rounded-3xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--ink))]">Audit &amp; Compliance Center</h1>
              <p className="text-sm text-[hsl(var(--muted))] mt-1">
                Cryptographically verified admin mutations, tamper detection, signed forensic export, and security incident tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="open-signed-export-btn"
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[hsl(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition shadow-sm"
            >
              <Download className="w-4 h-4" />
              Signed Audit Export
            </button>
          </div>
        </div>

        {/* Prominent Cryptographic Hash Chain Verification Banner */}
        <AuditChainStatusBanner />

        {/* Main Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[hsl(var(--line))] pb-px">
          <button
            id="tab-audit-explorer-btn"
            onClick={() => setActiveTab('explorer')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'explorer'
                ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                : 'border-transparent text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))]'
            }`}
          >
            <History className="w-4 h-4" />
            Immutable Audit Trail
          </button>

          <button
            id="tab-audit-incidents-btn"
            onClick={() => setActiveTab('incidents')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'incidents'
                ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
                : 'border-transparent text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Security Incidents &amp; Break-Glass
          </button>
        </div>

        {/* Tab Panels */}
        <div>
          {activeTab === 'explorer' && <AuditExplorerTable />}
          {activeTab === 'incidents' && <SecurityIncidentsManager />}
        </div>

        {/* Signed Export Modal */}
        <AuditSignedExportModal 
          isOpen={showExportModal} 
          onClose={() => setShowExportModal(false)} 
        />
      </div>
    </AdminLayout>
  );
}

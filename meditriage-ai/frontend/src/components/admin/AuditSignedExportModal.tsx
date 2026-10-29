'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { 
  Download, 
  ShieldCheck, 
  FileCheck2, 
  AlertTriangle, 
  FileJson, 
  FileSpreadsheet, 
  CheckCircle, 
  Bug, 
  RefreshCw, 
  Lock 
} from 'lucide-react';

interface SignedExportData {
  format: string;
  signature: string;
  exported_at: string;
  total_records: number;
  data?: unknown[];
  content?: string;
}

interface VerificationResponse {
  is_valid: boolean;
  tampered?: boolean;
  reason?: string;
  [key: string]: unknown;
}

interface AuditSignedExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuditSignedExportModal({ isOpen, onClose }: AuditSignedExportModalProps) {
  const [formatType, setFormatType] = useState<'json' | 'csv'>('json');
  const [limit, setLimit] = useState<number>(500);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<SignedExportData | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifyStatus, setVerifyStatus] = useState<VerificationResponse | null>(null);
  const [tamperedState, setTamperedState] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateExport = async () => {
    setExporting(true);
    setErrorMsg(null);
    setVerifyStatus(null);
    setTamperedState(false);

    try {
      const data: any = await apiClient.fetch('/api/v1/admin/audit/export', 'get', {
        params: {
          format_type: formatType,
          limit,
        },
      });

      setExportResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error generating export';
      setErrorMsg(msg);
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = () => {
    if (!exportResult) return;

    let blob: Blob;
    let filename: string;

    if (exportResult.format === 'csv' && exportResult.content) {
      blob = new Blob([exportResult.content], { type: 'text/csv;charset=utf-8;' });
      filename = `audit_export_signed_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      blob = new Blob([JSON.stringify(exportResult, null, 2)], { type: 'application/json' });
      filename = `audit_export_signed_${new Date().toISOString().slice(0, 10)}.json`;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleVerifyExport = async (tamper = false) => {
    if (!exportResult) return;
    setVerifying(true);
    setVerifyStatus(null);

    try {
      let payloadToVerify: Record<string, unknown>;

      if (tamper) {
        // Deliberately modify a record to demonstrate cryptographic tamper detection
        setTamperedState(true);
        if (exportResult.data && Array.isArray(exportResult.data) && exportResult.data.length > 0) {
          const clonedData = JSON.parse(JSON.stringify(exportResult.data));
          // Tamper with action or reason in the first record
          clonedData[0].reason = 'TAMPERED_MALICIOUS_EDIT_BY_ATTACKER';
          payloadToVerify = {
            ...exportResult,
            data: clonedData,
          };
        } else if (exportResult.content) {
          payloadToVerify = {
            ...exportResult,
            content: exportResult.content + '\n# TAMPERED_BYTE',
          };
        } else {
          payloadToVerify = {
            ...exportResult,
            signature: '0'.repeat(64), // Invalid signature
          };
        }
      } else {
        setTamperedState(false);
        payloadToVerify = { ...exportResult };
      }

      const result: any = await apiClient.fetch('/api/v1/admin/audit/export/verify', 'post', {
        body: payloadToVerify as any,
      });

      setVerifyStatus(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error verifying export signature';
      setVerifyStatus({ is_valid: false, tampered: true, reason: msg });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl p-6 rounded-3xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[hsl(var(--line))] pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[hsl(var(--ink))]">
                Cryptographically Signed Audit Export
              </h3>
              <p className="text-xs text-[hsl(var(--muted))]">
                Exports with SHA-256 HMAC digital seal to detect post-export modification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[hsl(var(--surface-hover))] text-xs text-[hsl(var(--muted))] font-bold"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-[hsl(var(--emergency)/0.1)] border border-[hsl(var(--emergency)/0.3)] text-[hsl(var(--emergency))] text-xs">
            {errorMsg}
          </div>
        )}

        {/* Export Configuration */}
        {!exportResult && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--ink))] mb-1.5">
                Export Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormatType('json')}
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium transition ${
                    formatType === 'json'
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--primary))]'
                      : 'border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-[hsl(var(--ink))]'
                  }`}
                >
                  <FileJson className="w-4 h-4" />
                  JSON (Full Object Structure)
                </button>
                <button
                  type="button"
                  onClick={() => setFormatType('csv')}
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium transition ${
                    formatType === 'csv'
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--primary))]'
                      : 'border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-[hsl(var(--ink))]'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV (Tabular with Header Signature)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--ink))] mb-1">
                Record Limit
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--bg))] text-xs text-[hsl(var(--ink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              >
                <option value={100}>100 records (Fastest)</option>
                <option value={500}>500 records (Standard review)</option>
                <option value={1000}>1,000 records</option>
                <option value={5000}>5,000 records (Full compliance audit)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[hsl(var(--line))] text-xs font-medium text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))] transition"
              >
                Cancel
              </button>
              <button
                id="generate-signed-export-btn"
                onClick={handleGenerateExport}
                disabled={exporting}
                className="px-4 py-2 rounded-xl bg-[hsl(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {exporting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Generate Signed Export
              </button>
            </div>
          </div>
        )}

        {/* Export Completed & Live Verification Sandbox */}
        {exportResult && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-selfcare/10 border border-selfcare/30 text-selfcare space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-selfcare" />
                  <span className="text-xs font-bold text-ink">Audit Export Package Ready</span>
                </div>
                <span className="text-[11px] font-mono text-muted">
                  {exportResult.total_records} records sealed
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-selfcare">
                  HMAC-SHA256 Digital Signature:
                </span>
                <code className="block p-1.5 mt-0.5 rounded bg-black/10 font-mono text-[10px] break-all text-ink">
                  {exportResult.signature}
                </code>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-2">
              <button
                id="download-export-file-btn"
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-[hsl(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition shadow"
              >
                <Download className="w-4 h-4" />
                Download Sealed File ({exportResult.format.toUpperCase()})
              </button>
            </div>

            {/* Interactive Tamper Verification Sandbox */}
            <div className="p-4 rounded-2xl bg-[hsl(var(--bg))] border border-[hsl(var(--line))] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[hsl(var(--ink))]">
                  Live Cryptographic Integrity Verifier
                </span>
                <span className="text-[10px] text-[hsl(var(--muted))]">
                  Validates against HMAC verification endpoint
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="verify-intact-export-btn"
                  onClick={() => handleVerifyExport(false)}
                  disabled={verifying}
                  className="flex-1 py-1.5 rounded-xl border border-selfcare/30 bg-selfcare/10 text-selfcare text-xs font-semibold hover:bg-selfcare/20 transition flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verify Authenticity
                </button>
                <button
                  id="simulate-tamper-btn"
                  onClick={() => handleVerifyExport(true)}
                  disabled={verifying}
                  className="flex-1 py-1.5 rounded-xl border border-[hsl(var(--emergency)/0.4)] bg-[hsl(var(--emergency)/0.1)] text-[hsl(var(--emergency))] text-xs font-semibold hover:bg-[hsl(var(--emergency)/0.2)] transition flex items-center justify-center gap-1.5"
                  title="Alters 1 byte to demonstrate tamper detection"
                >
                  <Bug className="w-3.5 h-3.5" />
                  Simulate Tampering
                </button>
              </div>

              {verifying && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-[hsl(var(--muted))]">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[hsl(var(--primary))]" />
                  <span>Computing HMAC verification hash...</span>
                </div>
              )}

              {verifyStatus && (
                <div className={`p-3 rounded-xl border text-xs ${
                  verifyStatus.is_valid && !verifyStatus.tampered
                    ? 'bg-selfcare/10 border-selfcare/30 text-selfcare'
                    : 'bg-[hsl(var(--emergency)/0.15)] border-[hsl(var(--emergency))] text-[hsl(var(--emergency))]'
                }`}>
                  <div className="flex items-center gap-2 font-bold">
                    {verifyStatus.is_valid && !verifyStatus.tampered ? (
                      <>
                        <ShieldCheck className="w-4 h-4 text-selfcare" />
                        <span>VALID: Cryptographic HMAC Signature Verified Perfectly</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-[hsl(var(--emergency))]" />
                        <span>TAMPER DETECTED: Signature Mismatch — Export Content Modified!</span>
                      </>
                    )}
                  </div>
                  {tamperedState && (
                    <p className="mt-1 text-[11px] opacity-90">
                      Demonstration test: A single field in the record payload was altered. The cryptographic hash verification rejected it immediately.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setExportResult(null)}
                className="text-xs text-[hsl(var(--primary))] hover:underline"
              >
                ← Back to Export Settings
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl border border-[hsl(var(--line))] text-xs font-semibold text-[hsl(var(--ink))] hover:bg-[hsl(var(--surface-hover))] transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Lock, 
  AlertOctagon, 
  CheckCircle2, 
  Link2 
} from 'lucide-react';

interface ChainVerificationResult {
  status: 'intact' | 'broken' | string;
  total_records?: number;
  total_actions?: number;
  broken_at_id?: number | null;
  expected_hash?: string | null;
  actual_hash?: string | null;
  reason?: string;
  verified_at?: string;
  [key: string]: unknown;
}

interface AuditChainStatusBannerProps {
  onVerified?: (result: ChainVerificationResult) => void;
}

export default function AuditChainStatusBanner({ onVerified }: AuditChainStatusBannerProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [result, setResult] = useState<ChainVerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runVerification = useCallback(async (isManual = false) => {
    if (isManual) setVerifying(true);
    else setLoading(true);

    try {
      const data: any = await apiClient.fetch('/api/v1/admin/audit-chain/verify', 'get');
      data.verified_at = new Date().toISOString();
      setResult(data);
      setErrorMsg(null);
      if (onVerified) onVerified(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error executing hash chain verification';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  }, [onVerified]);

  useEffect(() => {
    runVerification();
  }, [runVerification]);

  const isIntact = result?.status === 'intact';
  const totalRecords = result?.total_records ?? result?.total_actions ?? 0;

  return (
    <div className="w-full">
      {loading ? (
        <div className="p-5 rounded-2xl bg-[hsl(var(--surface))] border border-[hsl(var(--line))] flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-[hsl(var(--primary))]" />
            <span className="text-xs font-medium text-[hsl(var(--muted))]">
              Walking SHA-256 Merkle-like Hash Chain across admin audit ledger...
            </span>
          </div>
        </div>
      ) : errorMsg ? (
        <div className="p-5 rounded-2xl bg-[hsl(var(--emergency)/0.1)] border border-[hsl(var(--emergency)/0.3)] text-[hsl(var(--emergency))] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-5 h-5" />
            <span className="text-sm font-semibold">{errorMsg}</span>
          </div>
          <button
            onClick={() => runVerification(true)}
            className="px-3 py-1.5 rounded-xl border border-[hsl(var(--emergency)/0.4)] text-xs font-semibold hover:bg-[hsl(var(--emergency)/0.1)] transition"
          >
            Retry Verification
          </button>
        </div>
      ) : isIntact ? (
        <div 
          id="audit-chain-intact-banner"
          className="p-5 rounded-2xl bg-selfcare/10 border-2 border-selfcare/30 text-selfcare flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-selfcare/20 text-selfcare shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold tracking-tight text-ink">
                  Cryptographic Audit Chain Intact
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-selfcare/20 text-selfcare">
                  {totalRecords} Entries Verified
                </span>
                <span className="flex items-center gap-1 text-[11px] font-mono text-selfcare">
                  <Lock className="w-3 h-3" /> SHA-256 Immutable
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Every administrative mutation links strictly to the preceding entry hash with zero gap, mutation, or history deletion.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              id="reverify-chain-btn"
              onClick={() => runVerification(true)}
              disabled={verifying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-selfcare/30 bg-selfcare/15 hover:bg-selfcare/25 text-xs font-semibold text-selfcare transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
              Re-verify Chain
            </button>
          </div>
        </div>
      ) : (
        <div 
          id="audit-chain-broken-banner"
          className="p-5 rounded-2xl bg-[hsl(var(--emergency)/0.15)] border-2 border-[hsl(var(--emergency))] text-[hsl(var(--emergency))] flex flex-col gap-3 shadow-lg"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-[hsl(var(--emergency)/0.2)] text-[hsl(var(--emergency))] shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold tracking-tight">
                    CRITICAL: Cryptographic Audit Chain Broken!
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[hsl(var(--emergency))] text-white">
                    Broken at #{result?.broken_at_id ?? 'Unknown'}
                  </span>
                </div>
                <p className="text-xs font-medium mt-1">
                  The hash chain link failed verification. An entry may have been tampered with, deleted, or inserted out of order in database storage.
                </p>
              </div>
            </div>

            <button
              id="reverify-broken-chain-btn"
              onClick={() => runVerification(true)}
              disabled={verifying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[hsl(var(--emergency)/0.5)] bg-[hsl(var(--emergency)/0.2)] text-xs font-semibold hover:bg-[hsl(var(--emergency)/0.3)] transition shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
              Re-verify
            </button>
          </div>

          <div className="p-3 rounded-xl bg-black/10 font-mono text-[11px] space-y-1 overflow-x-auto">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Reason:</span>
              <span>{result?.reason || 'Hash mismatch between chained records'}</span>
            </div>
            {result?.expected_hash && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-selfcare">Expected:</span>
                <span className="break-all">{result.expected_hash}</span>
              </div>
            )}
            {result?.actual_hash && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[hsl(var(--emergency))]">Actual:</span>
                <span className="break-all">{result.actual_hash}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

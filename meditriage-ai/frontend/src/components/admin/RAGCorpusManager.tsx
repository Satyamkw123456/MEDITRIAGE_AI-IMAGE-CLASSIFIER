"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect } from "react";
import {
  Server,
  Power,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  BookOpen
} from "lucide-react";

interface RAGSource {
  source_name: string;
  source_url: string;
  license_note: string;
  is_disabled: boolean;
  total_chunks?: number;
}

export function RAGCorpusManager() {
  const [sources, setSources] = useState<RAGSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  // Disable confirmation dialog
  const [confirmSource, setConfirmSource] = useState<RAGSource | null>(null);
  const [disableReason, setDisableReason] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    setLoading(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/operations/rag/sources", "get");
      setSources(data.sources || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSource = async (source: RAGSource) => {
    if (!source.is_disabled) {
      // Prompt for confirmation
      setConfirmSource(source);
      setDisableReason("");
    } else {
      // Enable immediately
      try {
        await apiClient.fetch("/api/v1/admin/operations/rag/sources/enable", "post", {
          body: { source_identifier: source.source_name },
        });
        setNotification({ type: "success", message: `Source '${source.source_name}' re-enabled for retrieval.` });
        fetchSources();
      } catch {
        setNotification({ type: "error", message: "Failed to enable source." });
      }
    }
  };

  const handleConfirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmSource) return;

    try {
      await apiClient.fetch("/api/v1/admin/operations/rag/sources/disable", "post", {
        body: {
          source_identifier: confirmSource.source_name,
          reason: disableReason.trim() || "Immediate clinical exclusion",
        },
      });
      setConfirmSource(null);
      setNotification({
        type: "success",
        message: `Source '${confirmSource.source_name}' DISABLED with IMMEDIATE EFFECT. Chunks are excluded from retrieval on the next query.`,
      });
      fetchSources();
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to disable source." });
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setNotification(null);
    try {
      await apiClient.fetch("/api/v1/admin/operations/rag/reindex", "post");
      setNotification({ type: "success", message: "RAG corpus re-index triggered successfully!" });
      fetchSources();
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Reindex failed." });
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-soft text-primary">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>RAG Knowledge Corpus & License Governance</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-bg border border-line text-muted">
                Immediate Exclusion Contract
              </span>
            </h2>
            <p className="text-xs text-muted">
              Audit approved medical guidelines, copyright licenses, and trigger live source disabling that takes effect on the very next query.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReindex}
          disabled={reindexing}
          className="px-4 py-2 rounded-lg bg-primary text-surface font-semibold text-xs hover:bg-primary/95 shadow-button flex items-center gap-1.5 disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${reindexing ? "animate-spin" : ""}`} />
          <span>{reindexing ? "Reindexing Corpus..." : "Trigger Full Re-Index"}</span>
        </button>
      </div>

      {notification && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
            notification.type === "success"
              ? "bg-selfcare/10 border-selfcare/30 text-selfcare"
              : "bg-emergency/10 border-emergency/30 text-emergency"
          }`}
        >
          <span>{notification.message}</span>
          <button type="button" onClick={() => setNotification(null)} className="text-muted hover:text-ink">
            Dismiss
          </button>
        </div>
      )}

      {/* Sources Table */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h3 className="font-heading font-bold text-sm text-ink">Approved Clinical Corpus Sources ({sources.length})</h3>
            <span className="text-muted text-[11px]">All ingested sources must include clear license notes</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-bg text-muted border-b border-line font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Source Title</th>
                <th className="py-2.5 px-4">Canonical URL / Citation</th>
                <th className="py-2.5 px-4">License / Copyright</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Immediate Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sources.map((s, idx) => (
                <tr key={idx} className="hover:bg-bg/40">
                  <td className="py-2.5 px-4 font-semibold text-ink">{s.source_name}</td>
                  <td className="py-2.5 px-4 font-mono text-muted text-[11px] max-w-xs truncate">
                    {s.source_url}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-bg border border-line text-ink">
                      {s.license_note || "Public Clinical Guidance"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                        s.is_disabled ? "bg-emergency/15 text-emergency" : "bg-selfcare/15 text-selfcare"
                      }`}
                    >
                      {s.is_disabled ? "DISABLED" : "ACTIVE"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggleSource(s)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        s.is_disabled
                          ? "border border-selfcare/30 text-selfcare hover:bg-selfcare/10"
                          : "border border-emergency/30 text-emergency hover:bg-emergency/10"
                      }`}
                    >
                      {s.is_disabled ? "Re-enable" : "Disable Source"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal to Disable Source */}
      {confirmSource && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-popover space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-emergency" />
              <h3 className="font-heading font-bold text-base text-ink">Confirm Immediate Source Exclusion</h3>
            </div>
            <p className="text-muted leading-relaxed">
              Disabling <strong>{confirmSource.source_name}</strong> will exclude all its embeddings from the vector retrieval engine immediately.
            </p>

            <form onSubmit={handleConfirmDisable} className="space-y-3">
              <div>
                <label className="block font-semibold text-ink mb-1">
                  Mandatory Governance Justification:
                </label>
                <textarea
                  rows={2}
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  placeholder="e.g. Superseded by updated national emergency guidelines..."
                  required
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmSource(null)}
                  className="px-4 py-2 rounded-lg border border-line text-muted hover:text-ink font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emergency text-surface font-semibold hover:bg-emergency/90 shadow-button"
                >
                  Confirm Exclusion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

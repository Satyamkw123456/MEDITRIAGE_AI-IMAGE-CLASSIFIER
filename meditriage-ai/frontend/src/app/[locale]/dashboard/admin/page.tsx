"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api/client";
import { 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  GitPullRequest, 
  FileCheck2, 
  Cpu, 
  Terminal, 
  ArrowRight, 
  RefreshCw, 
  CheckCircle2, 
  Sliders, 
  Lock, 
  Activity, 
  Users,
  ShieldCheck,
  ChevronRight,
  Info
} from "lucide-react";

export interface NeedsAttentionCategory {
  category: string;
  title: string;
  count: number;
  severity: "critical" | "high" | "medium" | "info";
  action_url: string;
  summary: string;
  metadata?: any;
}

export interface NeedsAttentionResponse {
  timestamp: string;
  total_categories: number;
  total_urgent_items: number;
  categories: NeedsAttentionCategory[];
}

// Maps backend aggregator action_url to frontend client-side routes
function mapActionUrlToRoute(backendUrl: string): string {
  if (backendUrl.includes("approvals")) {
    return "/dashboard/admin/approvals";
  }
  if (backendUrl.includes("clinicians")) {
    return "/dashboard/admin/access?tab=clinicians";
  }
  if (backendUrl.includes("dpdp")) {
    return "/dashboard/admin/dpdp?filter=overdue";
  }
  if (backendUrl.includes("is_emergency=true")) {
    return "/dashboard/admin/cases?filter=red_flags";
  }
  if (backendUrl.includes("ai-gateway") || backendUrl.includes("fallback")) {
    return "/dashboard/admin/cases?filter=low_confidence";
  }
  if (backendUrl.includes("jobs?status=failed")) {
    return "/dashboard/admin/cases?filter=stuck";
  }
  if (backendUrl.includes("stale_emergency")) {
    return "/dashboard/admin/access?tab=users";
  }
  if (backendUrl.includes("audit/chain")) {
    return "/dashboard/admin/approvals";
  }
  return "/dashboard/admin/cases?filter=unreviewed";
}

export default function AdminCommandRoomPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<NeedsAttentionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadNeedsAttention = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json: any = await apiClient.fetch("/api/v1/admin/needs-attention", "get");
      setData(json);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load operational attention status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNeedsAttention();
  }, [loadNeedsAttention]);

  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header & Status Bar */}
          <div className="rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emergency/10 text-emergency font-mono text-xs font-semibold">
                  <Activity className="w-3.5 h-3.5" />
                  Live Operational Control Room
                </span>
                <span className="font-mono text-xs text-muted">
                  Session: <strong className="text-ink">{user?.name}</strong> ({user?.role})
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold text-ink tracking-tight">
                Needs-Attention Operational Worklist
              </h1>
              <p className="text-xs text-muted mt-1 max-w-2xl leading-relaxed">
                Aggregated system health telemetry across clinical safety, SLA breaches, dual-control authorizations, and DPDP mandates. Every indicator provides a direct action route.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="text-right text-xs hidden sm:block">
                <div className="text-muted">Telemetry Last Updated:</div>
                <div className="font-mono text-ink font-semibold">{lastRefreshed.toLocaleTimeString()}</div>
              </div>

              <button
                type="button"
                onClick={loadNeedsAttention}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line bg-bg hover:bg-surface text-xs font-medium text-ink transition-colors shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
                <span>Refresh Status</span>
              </button>
            </div>
          </div>

          {/* Notifications */}
          {error && (
            <div className="p-4 rounded-xl border border-emergency/30 bg-emergency/5 text-xs text-emergency flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </span>
              <button type="button" onClick={loadNeedsAttention} className="underline font-semibold">
                Retry
              </button>
            </div>
          )}

          {/* Quick Metrics Bar with Zero Dead Ends */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashboard/admin/cases?filter=unreviewed"
              className="rounded-card border border-line bg-surface p-4 shadow-xs hover:border-primary/50 hover:shadow-card transition-all group flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Unreviewed Cases &gt; 24h</p>
                <p className="text-2xl font-mono font-bold text-ink group-hover:text-primary transition-colors">
                  {data?.categories.find((c) => c.category === "unacknowledged_red_flags")?.count || 0}
                </p>
                <span className="text-[11px] text-primary flex items-center gap-1 mt-1 font-medium">
                  <span>Open Triage Queue</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emergency/10 text-emergency flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </Link>

            <Link
              href="/dashboard/admin/approvals"
              className="rounded-card border border-line bg-surface p-4 shadow-xs hover:border-primary/50 hover:shadow-card transition-all group flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Dual-Control Approvals</p>
                <p className="text-2xl font-mono font-bold text-ink group-hover:text-primary transition-colors">
                  {data?.categories.find((c) => c.category === "pending_approvals")?.count || 0}
                </p>
                <span className="text-[11px] text-primary flex items-center gap-1 mt-1 font-medium">
                  <span>Authorize Actions</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                <GitPullRequest className="w-5 h-5" />
              </div>
            </Link>

            <Link
              href="/dashboard/admin/dpdp?filter=overdue"
              className="rounded-card border border-line bg-surface p-4 shadow-xs hover:border-primary/50 hover:shadow-card transition-all group flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">DPDP Requests Near SLA</p>
                <p className="text-2xl font-mono font-bold text-ink group-hover:text-primary transition-colors">
                  {data?.categories.find((c) => c.category === "data_rights_near_sla")?.count || 0}
                </p>
                <span className="text-[11px] text-primary flex items-center gap-1 mt-1 font-medium">
                  <span>Fulfill Data Rights</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-urgent/10 text-urgent flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </Link>

            <Link
              href="/dashboard/admin/access?tab=clinicians"
              className="rounded-card border border-line bg-surface p-4 shadow-xs hover:border-primary/50 hover:shadow-card transition-all group flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Pending Clinicians</p>
                <p className="text-2xl font-mono font-bold text-ink group-hover:text-primary transition-colors">
                  {data?.categories.find((c) => c.category === "unverified_clinicians")?.count || 0}
                </p>
                <span className="text-[11px] text-primary flex items-center gap-1 mt-1 font-medium">
                  <span>Inspect Credentials</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-selfcare/10 text-selfcare flex items-center justify-center">
                <FileCheck2 className="w-5 h-5" />
              </div>
            </Link>
          </div>

          {/* Central Prioritised Worklist (Aggregated 8 Items from Cycle 6 Backend) */}
          <div className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
            <div className="p-4 bg-bg/50 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-primary" />
                <h2 className="font-heading font-bold text-sm text-ink uppercase tracking-wider">
                  Prioritised Action Items ({data?.categories?.length || 0} Telemetry Monitors)
                </h2>
              </div>

              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-emergency/10 text-emergency font-semibold">
                {data?.total_urgent_items || 0} Urgent Items Requiring Resolution
              </span>
            </div>

            <div className="divide-y divide-line/60">
              {loading ? (
                <div className="p-12 text-center text-muted">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                  <span>Evaluating clinical safety monitors and queues...</span>
                </div>
              ) : !data || data.categories.length === 0 ? (
                <div className="p-12 text-center text-muted space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-selfcare mx-auto" />
                  <p className="font-semibold text-ink text-base">All Operational Worklists Clear</p>
                  <p className="text-xs text-muted">Zero pending alerts, SLA breaches, or unreviewed credentials detected.</p>
                </div>
              ) : (
                data.categories.map((cat) => {
                  const targetRoute = mapActionUrlToRoute(cat.action_url);
                  const isCritical = cat.severity === "critical";
                  const isHigh = cat.severity === "high";

                  return (
                    <div
                      key={cat.category}
                      className="p-4 hover:bg-bg/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isCritical
                              ? "bg-emergency/15 text-emergency"
                              : isHigh
                              ? "bg-urgent/15 text-urgent"
                              : "bg-primary-soft text-primary"
                          }`}
                        >
                          {isCritical ? (
                            <AlertTriangle className="w-5 h-5" />
                          ) : (
                            <Activity className="w-5 h-5" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-heading font-semibold text-sm text-ink">
                              {cat.title}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                                isCritical
                                  ? "bg-emergency/15 text-emergency"
                                  : isHigh
                                  ? "bg-urgent/15 text-urgent"
                                  : "bg-bg text-muted border border-line"
                              }`}
                            >
                              {cat.severity}
                            </span>
                          </div>
                          <p className="text-xs text-muted leading-relaxed">
                            {cat.summary}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <span className="font-mono text-sm font-bold text-ink px-2.5 py-1 rounded-md bg-bg border border-line">
                          {cat.count}
                        </span>

                        <Link
                          href={targetRoute}
                          className="px-3.5 py-1.5 rounded-lg bg-primary text-surface text-xs font-semibold hover:bg-primary-dark transition-all flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                        >
                          <span>Action Queue</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Direct Access Tools Grid */}
          <div className="space-y-3">
            <h3 className="font-heading font-bold text-sm text-ink uppercase tracking-wider px-1">
              Administrative Control Planes
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/dashboard/admin/access?tab=matrix"
                className="rounded-card border border-line bg-surface p-4 shadow-xs hover:border-primary/50 hover:shadow-card transition-all flex items-start gap-3 group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-semibold text-sm text-ink group-hover:text-primary transition-colors">
                    Permission Matrix Editor (Spike)
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Search and bulk-assign across 40+ granular RBAC permissions. Create custom roles with self-lockout guards.
                  </p>
                </div>
              </Link>

              <Link
                href="/dashboard/admin/flags?tab=killswitches"
                className="rounded-card border border-line bg-surface p-4 shadow-xs hover:border-emergency/50 hover:shadow-card transition-all flex items-start gap-3 group"
              >
                <div className="w-9 h-9 rounded-lg bg-emergency/10 text-emergency flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-semibold text-sm text-ink group-hover:text-emergency transition-colors">
                    Emergency Kill Switches
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Circuit breakers for AI inference and external carriers with explicit &quot;Degrades X to Y&quot; safety contracts.
                  </p>
                </div>
              </Link>

              <Link
                href="/dashboard/admin/flags?tab=composition"
                className="rounded-card border border-line bg-surface p-4 shadow-xs hover:border-primary/50 hover:shadow-card transition-all flex items-start gap-3 group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-semibold text-sm text-ink group-hover:text-primary transition-colors">
                    Role-Based Panel Composition
                  </h4>
                  <p className="text-xs text-muted mt-0.5">
                    Control which AI Hub cards, intake sections, and clinician tools render for each user role in live UI.
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect } from "react";
import {
  Clock,
  Play,
  RotateCcw,
  Pause,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Terminal,
  Activity,
  X
} from "lucide-react";

interface JobRun {
  id: number;
  job_name: string;
  status: string;
  payload: any;
  created_at: string;
  updated_at: string;
}

export function JobsMonitor() {
  const [jobs, setJobs] = useState<JobRun[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobRun | null>(null);

  const [loading, setLoading] = useState(false);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchJobs();
    fetchSchedulerStatus();
  }, []);

  const fetchSchedulerStatus = async () => {
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/operations/health", "get");
      if (data.scheduler?.is_paused !== undefined) {
        setIsPaused(Boolean(data.scheduler.is_paused));
      }
    } catch {
      // Ignore
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/operations/jobs", "get");
      setJobs(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleRunJob = async (jobName: string) => {
    setTriggeringJob(jobName);
    setNotification(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/operations/jobs/run", "post", {
        params: { job_name: jobName },
      });
      setNotification({
        type: "success",
        message: `Job '${jobName}' completed with status: ${data.status}!`,
      });
      fetchJobs();
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Job trigger failed." });
    } finally {
      setTriggeringJob(null);
    }
  };

  const handleRetryJob = async (jobId: number) => {
    setLoading(true);
    setNotification(null);
    try {
      await apiClient.fetch("/api/v1/admin/operations/jobs/retry/{job_id}", "post", {
        pathParams: { job_id: jobId },
      });
      setNotification({ type: "success", message: `Job #${jobId} retried successfully!` });
      fetchJobs();
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to retry job." });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleScheduler = async () => {
    try {
      const endpoint = isPaused
        ? "/api/v1/admin/operations/scheduler/resume"
        : "/api/v1/admin/operations/scheduler/pause";
      const data: any = await apiClient.fetch(endpoint, "post");
      setIsPaused(Boolean(data.is_paused));
      setNotification({
        type: "success",
        message: data.is_paused
          ? "Background scheduler PAUSED by administrator."
          : "Background scheduler RESUMED to normal operation.",
      });
    } catch {
      setNotification({ type: "error", message: "Failed to toggle scheduler state." });
    }
  };

  const standardJobs = [
    { name: "stale_directory_scan", label: "Emergency Directory 90-Day Freshness Scan" },
    { name: "audit_chain_verify", label: "Cryptographic SHA-256 Hash Chain Integrity Audit" },
    { name: "retention_purge", label: "Statutory DPDP Data Retention & PHI Purge Run" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-soft text-primary">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Background Jobs & Task Scheduler Monitor</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold uppercase ${
                  isPaused ? "bg-urgent/15 text-urgent" : "bg-selfcare/15 text-selfcare"
                }`}
              >
                {isPaused ? "SCHEDULER PAUSED" : "SCHEDULER ACTIVE"}
              </span>
            </h2>
            <p className="text-xs text-muted">
              Manages automated maintenance cron jobs, manual triggers, retry queues, and execution telemetry.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleScheduler}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs ${
            isPaused
              ? "bg-selfcare text-surface hover:bg-selfcare/90"
              : "border border-urgent/30 text-urgent hover:bg-urgent/10"
          }`}
        >
          {isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          <span>{isPaused ? "Resume Scheduler" : "Pause Scheduler"}</span>
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

      {/* Quick Trigger Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {standardJobs.map((j) => (
          <div key={j.name} className="p-4 rounded-xl border border-line bg-surface shadow-xs space-y-3 text-xs">
            <span className="font-mono font-bold text-primary block truncate">{j.name}</span>
            <p className="text-muted text-[11px] leading-relaxed">{j.label}</p>
            <button
              type="button"
              onClick={() => handleRunJob(j.name)}
              disabled={triggeringJob === j.name}
              className="w-full py-1.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary/95 shadow-button flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              <span>{triggeringJob === j.name ? "Executing..." : "Run Job Now"}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Job Execution History */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h3 className="font-heading font-bold text-sm text-ink">Recent Job Executions ({jobs.length})</h3>
            <span className="text-muted text-[11px]">Audit trail of automated and manual cron task runs</span>
          </div>
          <button
            type="button"
            onClick={fetchJobs}
            className="px-3 py-1 rounded-lg border border-line text-muted hover:text-ink"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-bg text-muted border-b border-line font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Run ID</th>
                <th className="py-2.5 px-4">Job Name</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Started At</th>
                <th className="py-2.5 px-4">Updated At</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No recent job runs found in database.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-bg/40">
                    <td className="py-2.5 px-4 font-mono font-bold text-ink">#{job.id}</td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-primary">{job.job_name}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          job.status === "SUCCESS"
                            ? "bg-selfcare/15 text-selfcare"
                            : job.status === "FAILED"
                            ? "bg-emergency/15 text-emergency"
                            : "bg-urgent/15 text-urgent"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-muted text-[11px]">{job.created_at}</td>
                    <td className="py-2.5 px-4 font-mono text-muted text-[11px]">{job.updated_at}</td>
                    <td className="py-2.5 px-4 text-right flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedJob(job)}
                        className="px-2.5 py-1 rounded bg-bg border border-line text-ink hover:border-primary text-xs"
                      >
                        Details
                      </button>
                      {job.status === "FAILED" && (
                        <button
                          type="button"
                          onClick={() => handleRetryJob(job.id)}
                          className="px-2 py-1 rounded bg-emergency/15 text-emergency hover:bg-emergency/25 text-xs font-semibold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failure Detail Modal */}
      {selectedJob && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-popover space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-heading font-bold text-base text-ink">
                Job Run #{selectedJob.id}: {selectedJob.job_name}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="text-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono">
              <div className="p-3 rounded-lg bg-bg border border-line flex justify-between">
                <span>Status: <strong className="text-primary">{selectedJob.status}</strong></span>
                <span>Updated: {selectedJob.updated_at}</span>
              </div>

              <div>
                <span className="font-semibold text-ink block mb-1">Execution Payload / Output:</span>
                <div className="p-3 rounded-lg bg-bg border border-line text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedJob.payload, null, 2)}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 rounded-lg border border-line text-muted hover:text-ink"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

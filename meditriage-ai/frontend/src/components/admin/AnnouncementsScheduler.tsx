"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { 
  Megaphone, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  RefreshCw,
  Info
} from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";

export interface AnnouncementItem {
  id: number;
  title: string;
  message: string;
  audience: string;
  banner_type: "info" | "warning" | "urgent";
  effective_at?: string;
  expires_at?: string;
  is_active: boolean;
  created_at?: string;
}

export function AnnouncementsScheduler() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Modal State
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [bannerType, setBannerType] = useState<"info" | "warning" | "urgent">("info");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Toggle Active State
  const [targetToggle, setTargetToggle] = useState<AnnouncementItem | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/announcements", "get", {
        params: { active_only: false },
      });
      setAnnouncements(data.announcements || []);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.fetch("/api/v1/admin/announcements", "post", {
        body: {
          title: title.trim(),
          message: message.trim(),
          audience,
          banner_type: bannerType,
          effective_at: effectiveAt ? new Date(effectiveAt).toISOString() : new Date().toISOString(),
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          reason: reason.trim(),
        },
      });

      setSuccessMsg(`Announcement '${title}' scheduled successfully.`);
      setNewModalOpen(false);
      setTitle("");
      setMessage("");
      setReason("");
      loadAnnouncements();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to create announcement.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActiveConfirmed = async ({ reason }: { category: string; reason: string }) => {
    if (!targetToggle) return;
    setReasonDialogOpen(false);
    try {
      await apiClient.fetch("/api/v1/admin/announcements/{announcement_id}", "patch", {
        pathParams: { announcement_id: targetToggle.id },
        body: {
          is_active: !targetToggle.is_active,
          reason,
        },
      });

      setSuccessMsg(`Announcement #${targetToggle.id} status updated.`);
      loadAnnouncements();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Action failed.");
    } finally {
      setTargetToggle(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-ink">
              System Announcements & In-App Banners
            </h3>
            <p className="text-xs text-muted">
              Schedule targeted clinical advisories, maintenance alerts, and public health guidelines across patient and clinician portals.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setNewModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-surface text-xs font-semibold hover:bg-primary-dark transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Announcement</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg border border-emergency/30 bg-emergency/5 text-xs text-emergency flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="underline font-semibold">Dismiss</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-lg border border-selfcare/30 bg-selfcare/5 text-xs text-selfcare flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="underline font-semibold">Dismiss</button>
        </div>
      )}

      {/* Announcements Table */}
      <div className="rounded-card border border-line bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/70 border-b border-line text-muted font-heading font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Title & Message</th>
                <th className="p-3">Audience</th>
                <th className="p-3">Banner Severity</th>
                <th className="p-3">Schedule Window</th>
                <th className="p-3">Active</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted">Loading announcements...</td>
                </tr>
              ) : announcements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted">No scheduled announcements found.</td>
                </tr>
              ) : (
                announcements.map((a) => (
                  <tr key={a.id} className="hover:bg-bg/40 transition-colors">
                    <td className="p-3 max-w-sm">
                      <div className="font-semibold text-ink">{a.title}</div>
                      <div className="text-muted text-[11px] truncate">{a.message}</div>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-bg border border-line uppercase">
                        {a.audience}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                          a.banner_type === "urgent"
                            ? "bg-emergency/15 text-emergency"
                            : a.banner_type === "warning"
                            ? "bg-urgent/15 text-urgent"
                            : "bg-primary-soft text-primary"
                        }`}
                      >
                        {a.banner_type}
                      </span>
                    </td>
                    <td className="p-3 text-muted text-[11px]">
                      {a.effective_at ? new Date(a.effective_at).toLocaleDateString() : "Now"} →{" "}
                      {a.expires_at ? new Date(a.expires_at).toLocaleDateString() : "Indefinite"}
                    </td>
                    <td className="p-3">
                      {a.is_active ? (
                        <span className="text-selfcare font-semibold text-xs">Live</span>
                      ) : (
                        <span className="text-muted text-xs">Inactive</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetToggle(a);
                          setReasonDialogOpen(true);
                        }}
                        className="text-xs px-2.5 py-1 rounded-md border border-line bg-surface hover:bg-bg text-ink font-medium"
                      >
                        {a.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Announcement */}
      {newModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-popover space-y-4">
            <h3 className="font-heading font-semibold text-base text-ink">
              Schedule New Announcement
            </h3>
            <form onSubmit={handleCreateAnnouncement} className="space-y-3 text-xs">
              <div>
                <label className="block text-ink font-medium mb-1">Title:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Planned Hospital System Maintenance"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
                />
              </div>

              <div>
                <label className="block text-ink font-medium mb-1">Message Content:</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Clinical advisory details..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-ink font-medium mb-1">Target Audience:</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
                  >
                    <option value="all">All Users</option>
                    <option value="patient">Patients & Caregivers</option>
                    <option value="clinician">Clinicians Only</option>
                    <option value="admin">Administrators</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink font-medium mb-1">Banner Type:</label>
                  <select
                    value={bannerType}
                    onChange={(e: any) => setBannerType(e.target.value)}
                    className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
                  >
                    <option value="info">Informational (Blue)</option>
                    <option value="warning">Warning / Advisory (Amber)</option>
                    <option value="urgent">Urgent / Emergency (Red)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-ink font-medium mb-1">Effective At:</label>
                  <input
                    type="datetime-local"
                    value={effectiveAt}
                    onChange={(e) => setEffectiveAt(e.target.value)}
                    className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-ink font-medium mb-1">Expires At:</label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-ink font-medium mb-1">Creation Justification (Reason):</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Justification for publishing announcement..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-line bg-bg text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary-dark"
                >
                  {saving ? "Scheduling..." : "Schedule Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reason Dialog for Toggle */}
      <ReasonDialog
        isOpen={reasonDialogOpen}
        title={`Toggle Announcement Status: #${targetToggle?.id}`}
        actionDescription={`Setting announcement #${targetToggle?.id} to ${targetToggle?.is_active ? "INACTIVE" : "ACTIVE"}.`}
        categories={["Advisory Schedule Update", "Outdated Protocol Retirement", "Emergency Notice Broadcasting"]}
        minReasonLength={5}
        onConfirm={handleToggleActiveConfirmed}
        onCancel={() => setReasonDialogOpen(false)}
      />
    </div>
  );
}

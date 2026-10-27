"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect } from "react";
import {
  PhoneCall,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Building2,
  Search,
  Check
} from "lucide-react";

interface EmergencyItem {
  id: number;
  name: string;
  category: string;
  phone_number: string;
  city_region: string;
  is_active: boolean;
  last_verified_at?: string | null;
  is_stale: boolean;
  days_since_verified?: number | null;
}

export function EmergencyDirectoryEditor() {
  const [resources, setResources] = useState<EmergencyItem[]>([]);
  const [filterStaleOnly, setFilterStaleOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("hospital");
  const [newPhone, setNewPhone] = useState("");
  const [newCity, setNewCity] = useState("Mumbai Metro");

  const [loading, setLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/content/resources", "get");
      setResources(data.resources || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (resId: number) => {
    setVerifyingId(resId);
    setNotification(null);
    try {
      await apiClient.fetch("/api/v1/admin/content/resources/{resource_id}/verify", "post", {
        pathParams: { resource_id: resId },
      });
      setNotification({
        type: "success",
        message: `Resource #${resId} verified! 90-day validity clock has been reset.`,
      });
      fetchResources();
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to verify resource." });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/content/resources", "post", {
        body: {
          name: newName.trim(),
          category: newCategory,
          phone_number: newPhone.trim(),
          city_region: newCity.trim(),
          is_active: true,
        },
      });
      setAddModalOpen(false);
      setNewName("");
      setNewPhone("");
      setNotification({ type: "success", message: `Emergency resource '${data.name}' added to public directory!` });
      fetchResources();
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to add resource." });
    }
  };

  const staleItems = resources.filter((r) => r.is_stale);
  const displayList = resources.filter((r) => {
    if (filterStaleOnly && !r.is_stale) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.phone_number.includes(q) ||
        r.city_region.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emergency/15 text-emergency">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Emergency Helpline & Facility Directory</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-bg border border-line text-muted">
                Statutory 90-Day Freshness SLA
              </span>
            </h2>
            <p className="text-xs text-muted">
              Direct emergency contact numbers surfaced to patients in red-flag scenarios. Numbers unverified for &gt; 90 days are automatically surfaced in Needs-Attention.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-primary text-surface font-semibold text-xs hover:bg-primary/95 shadow-button flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Emergency Resource</span>
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

      {/* Prominent Stale Directory Worklist Banner if any exist */}
      {staleItems.length > 0 && (
        <div className="p-4 rounded-xl border border-emergency/40 bg-emergency/10 text-emergency space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>{staleItems.length} EMERGENCY RESOURCES REQUIRE VERIFICATION (&gt; 90 DAYS OLD)</span>
            </div>
            <button
              type="button"
              onClick={() => setFilterStaleOnly(!filterStaleOnly)}
              className="text-xs underline font-semibold text-emergency hover:text-emergency/80"
            >
              {filterStaleOnly ? "Show All Resources" : "Filter to Stale Worklist"}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-ink/90">
            Emergency helpline numbers and facility addresses must be re-verified at least once every 90 days per clinical governance standards.
            Click &quot;Verify Now&quot; below after confirming that the phone line is operational.
          </p>
        </div>
      )}

      {/* Directory Table */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search facility name, city, phone..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-muted hover:text-ink">
              <input
                type="checkbox"
                checked={filterStaleOnly}
                onChange={(e) => setFilterStaleOnly(e.target.checked)}
                className="rounded border-line text-primary focus:ring-primary"
              />
              <span>Stale &gt; 90d Only ({staleItems.length})</span>
            </label>
            <span className="text-muted font-mono text-[11px]">{displayList.length} total resources</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-bg text-muted border-b border-line font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Facility / Resource</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Phone Number</th>
                <th className="py-2.5 px-4">Region</th>
                <th className="py-2.5 px-4">Last Verified</th>
                <th className="py-2.5 px-4">Freshness Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {displayList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    No matching emergency directory resources found.
                  </td>
                </tr>
              ) : (
                displayList.map((item) => (
                  <tr key={item.id} className="hover:bg-bg/40">
                    <td className="py-2.5 px-4 font-semibold text-ink">{item.name}</td>
                    <td className="py-2.5 px-4 font-mono uppercase text-muted text-[11px]">{item.category}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-primary">{item.phone_number}</td>
                    <td className="py-2.5 px-4 text-ink">{item.city_region}</td>
                    <td className="py-2.5 px-4 font-mono text-muted text-[11px]">
                      {item.last_verified_at || "Never Verified"}
                    </td>
                    <td className="py-2.5 px-4">
                      {item.is_stale ? (
                        <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emergency/15 text-emergency flex items-center gap-1 w-max">
                          <AlertTriangle className="w-3 h-3" />
                          STALE &gt; 90d
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-selfcare/15 text-selfcare flex items-center gap-1 w-max">
                          <CheckCircle2 className="w-3 h-3" />
                          VERIFIED
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleVerify(item.id)}
                        disabled={verifyingId === item.id}
                        className="px-2.5 py-1 rounded-lg border border-line text-xs font-semibold hover:bg-bg text-ink transition-colors"
                      >
                        {verifyingId === item.id ? "Verifying..." : "Verify Now"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Resource Modal */}
      {addModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-popover space-y-4 text-xs">
            <h3 className="font-heading font-bold text-base text-ink pb-2 border-b border-line">
              Add Emergency Resource
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-ink mb-1">Facility / Service Name:</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. City Trauma Center Emergency Helpline"
                  required
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Category:</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink"
                >
                  <option value="ambulance">Emergency Ambulance (108/102)</option>
                  <option value="hospital">Hospital Trauma / Casualty</option>
                  <option value="mental_health">Mental Health / Suicide Prevention</option>
                  <option value="poison_control">Poison Control Center</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Phone Number (Dialable):</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. 108 or +91-22-26543210"
                  required
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">City / Region Scope:</label>
                <input
                  type="text"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="e.g. Mumbai Metro / Maharashtra"
                  required
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-line text-muted hover:text-ink font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-primary text-surface font-semibold hover:bg-primary/95 shadow-button"
                >
                  Save to Directory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

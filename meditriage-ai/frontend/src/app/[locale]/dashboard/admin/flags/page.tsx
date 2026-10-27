"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sliders, Power, Settings, LayoutGrid, Megaphone, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { FeatureFlagsTable } from "@/components/admin/FeatureFlagsTable";
import { KillSwitchManager } from "@/components/admin/KillSwitchManager";
import { SettingsEditor } from "@/components/admin/SettingsEditor";
import { PanelCompositionEditor } from "@/components/admin/PanelCompositionEditor";
import { AnnouncementsScheduler } from "@/components/admin/AnnouncementsScheduler";

export default function FlagsAndSettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") || "flags";

  const [activeTab, setActiveTab] = useState<"flags" | "killswitches" | "settings" | "composition" | "announcements">("flags");

  useEffect(() => {
    if (["flags", "killswitches", "settings", "composition", "announcements"].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);

  const setTab = (tab: "flags" | "killswitches" | "settings" | "composition" | "announcements") => {
    setActiveTab(tab);
    router.replace(`/dashboard/admin/flags?tab=${tab}`);
  };

  return (
    <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Top Breadcrumb & Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted mb-1">
                <Link href="/dashboard/admin" className="hover:text-primary transition-colors flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Command Room</span>
                </Link>
                <span>/</span>
                <span className="text-ink font-medium">Control Plane</span>
              </div>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
                Flags, Settings & Kill Switches
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Govern operational switches, live canary flags, configuration rollback points, and role-based UI composition.
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="inline-flex rounded-xl border border-line bg-surface p-1 shadow-xs text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setTab("flags")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "flags"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Feature Flags</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("killswitches")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "killswitches"
                    ? "bg-emergency text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>Kill Switches</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("settings")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "settings"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings & Rollback</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("composition")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "composition"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Panel Composition</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("announcements")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  activeTab === "announcements"
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>Announcements</span>
              </button>
            </div>
          </div>

          {/* Tab Views */}
          {activeTab === "flags" && <FeatureFlagsTable />}
          {activeTab === "killswitches" && <KillSwitchManager />}
          {activeTab === "settings" && <SettingsEditor />}
          {activeTab === "composition" && <PanelCompositionEditor />}
          {activeTab === "announcements" && <AnnouncementsScheduler />}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect } from "react";
import {
  Languages,
  Search,
  Save,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Globe
} from "lucide-react";

interface I18nPayload {
  locales: string[];
  strings: Record<string, { en?: string; hi?: string; mr?: string; [key: string]: string | undefined }>;
  [key: string]: any;
}

export function I18nStringEditor() {
  const [data, setData] = useState<I18nPayload>({
    locales: ["en", "hi", "mr"],
    strings: {},
  });
  const [searchKey, setSearchKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchI18n();
  }, []);

  const fetchI18n = async () => {
    setLoading(true);
    try {
      const json: any = await apiClient.fetch("/api/v1/admin/content/i18n", "get");
      setData(json);
    } catch {
      setNotification({ type: "error", message: "Failed to load i18n translations." });
    } finally {
      setLoading(false);
    }
  };

  const handleStringChange = (key: string, lang: string, val: string) => {
    setData((prev) => ({
      ...prev,
      strings: {
        ...prev.strings,
        [key]: {
          ...prev.strings[key],
          [lang]: val,
        },
      },
    }));
  };

  const handleSaveStrings = async () => {
    setSaving(true);
    setNotification(null);
    try {
      await apiClient.fetch("/api/v1/admin/content/i18n", "post", {
        body: {
          payload: data,
          reason: "Updated localization string bundles across EN, HI, MR",
        },
      });
      setNotification({ type: "success", message: "Translations updated and published to runtime cache!" });
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to save translations." });
    } finally {
      setSaving(false);
    }
  };

  const filteredKeys = Object.keys(data.strings || {}).filter((k) =>
    k.toLowerCase().includes(searchKey.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-soft text-primary">
            <Languages className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Multilingual String Translation Editor</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-bg border border-line text-muted">
                Locales: EN, HI, MR
              </span>
            </h2>
            <p className="text-xs text-muted">
              Live authoring and publishing of localized clinical terminology, safety banners, and UI labels.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveStrings}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-surface font-semibold text-xs hover:bg-primary/95 shadow-button flex items-center gap-1.5 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? "Publishing..." : "Publish String Changes"}</span>
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

      {/* Filter and Key List */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
            <input
              type="text"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              placeholder="Search translation key (e.g. common.welcome)..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <span className="text-xs text-muted font-mono">
            {filteredKeys.length} localization keys found
          </span>
        </div>

        <div className="space-y-4">
          {filteredKeys.map((key) => {
            const entry = data.strings[key] || {};
            return (
              <div key={key} className="p-4 rounded-xl border border-line bg-bg/40 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-primary">{key}</span>
                  <div className="flex gap-1">
                    {["en", "hi", "mr"].map((loc) => (
                      <span
                        key={loc}
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold uppercase ${
                          entry[loc] ? "bg-selfcare/15 text-selfcare" : "bg-emergency/15 text-emergency"
                        }`}
                      >
                        {loc} {entry[loc] ? "✓" : "MISSING"}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">English (EN):</label>
                    <input
                      type="text"
                      value={entry.en || ""}
                      onChange={(e) => handleStringChange(key, "en", e.target.value)}
                      className="w-full p-2 rounded-lg border border-line bg-surface text-ink text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">Hindi (HI - हिंदी):</label>
                    <input
                      type="text"
                      value={entry.hi || ""}
                      onChange={(e) => handleStringChange(key, "hi", e.target.value)}
                      className="w-full p-2 rounded-lg border border-line bg-surface text-ink text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">Marathi (MR - मराठी):</label>
                    <input
                      type="text"
                      value={entry.mr || ""}
                      onChange={(e) => handleStringChange(key, "mr", e.target.value)}
                      className="w-full p-2 rounded-lg border border-line bg-surface text-ink text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

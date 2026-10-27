"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Save,
  CheckCircle2,
  FileEdit,
  LayoutGrid
} from "lucide-react";

interface CardContent {
  title: string;
  description: string;
}

export function AIHubResourceCardEditor() {
  const [cards, setCards] = useState<Record<string, CardContent>>({
    daily_checkin: {
      title: "Daily Geriatric Check-In",
      description: "Log quick mood, pain, and home vitals to monitor chronic health baselines and detect acute drift early.",
    },
    medication_review: {
      title: "Medication Safety Review",
      description: "Screen your daily medicines for anticholinergic cognitive burden and geriatric interaction flags.",
    },
    summary_explainer: {
      title: "Explain My Triage Summary",
      description: "Translate complex medical terms and triage explanations into easy-to-understand plain language.",
    },
    visit_prep: {
      title: "Doctor Visit Preparation",
      description: "Generate customized questions, key symptom summaries, and timeline notes to bring to your doctor appointment.",
    },
  });

  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/content/ai-hub-cards", "get");
      setCards(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleCardChange = (cardKey: string, field: "title" | "description", val: string) => {
    setCards((prev) => ({
      ...prev,
      [cardKey]: {
        ...prev[cardKey],
        [field]: val,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotification(null);
    try {
      await apiClient.fetch("/api/v1/admin/content/ai-hub-cards", "post", {
        body: {
          cards,
          reason: reason.trim() || "Updated patient AI Hub card copy",
        },
      });
      setNotification({ type: "success", message: "Patient AI Hub card copy updated and live!" });
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to update cards." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-soft text-primary">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Patient & Caregiver AI Hub Card Copy Editor</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-bg border border-line text-muted">
                Cycle 9 UI Integration
              </span>
            </h2>
            <p className="text-xs text-muted">
              Controls the descriptive titles and patient-facing clinical explanations for feature cards on the patient AI Hub.
            </p>
          </div>
        </div>
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

      {/* Cards Editor Form */}
      <form onSubmit={handleSave} className="space-y-6 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(cards).map(([key, card]) => (
            <div key={key} className="p-5 rounded-xl border border-line bg-surface shadow-card space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="font-mono font-bold text-primary text-[11px] uppercase">
                  Card Identifier: {key}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-bg text-muted font-mono">
                  Patient Visible
                </span>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Card Title:</label>
                <input
                  type="text"
                  value={card.title}
                  onChange={(e) => handleCardChange(key, "title", e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">
                  Card Explanatory Description (Patient-Facing):
                </label>
                <textarea
                  rows={3}
                  value={card.description}
                  onChange={(e) => handleCardChange(key, "description", e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl border border-line bg-surface shadow-card space-y-3">
          <div>
            <label className="block font-semibold text-ink mb-1">Mandatory Change Justification:</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Clarified plain language wording for geriatric medication review card"
              required
              className="w-full p-2.5 rounded-lg border border-line bg-bg text-ink"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-primary text-surface font-semibold hover:bg-primary/95 shadow-button disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Publishing Copy..." : "Save & Publish Card Content"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

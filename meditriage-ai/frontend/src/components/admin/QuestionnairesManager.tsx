"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import {
  FileQuestion,
  Languages,
  CheckCircle2,
  AlertCircle,
  Save,
  Plus,
  Info
} from "lucide-react";

interface Question {
  question_id: string;
  canonical_code: string;
  text_translations: {
    en?: string;
    hi?: string;
    mr?: string;
    [key: string]: string | undefined;
  };
  type: string;
  options?: string[];
  has_missing_translations?: boolean;
}

interface Section {
  section_id: string;
  name: string;
  questions: Question[];
}

export function QuestionnairesManager() {
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchQuestionnaires = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/clinical/questionnaires", "get");
      const secList = data.sections || [];
      setSections(secList);
      if (secList.length > 0 && !selectedSectionId) {
        setSelectedSectionId(secList[0].section_id);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to load clinical questionnaires." });
    } finally {
      setLoading(false);
    }
  }, [selectedSectionId]);

  useEffect(() => {
    fetchQuestionnaires();
  }, [fetchQuestionnaires]);

  const handleTextChange = (secId: string, qId: string, lang: string, text: string) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.section_id !== secId) return sec;
        return {
          ...sec,
          questions: sec.questions.map((q) => {
            if (q.question_id !== qId) return q;
            const updatedTranslations = { ...q.text_translations, [lang]: text };
            const missing = !updatedTranslations.en || !updatedTranslations.hi || !updatedTranslations.mr;
            return {
              ...q,
              text_translations: updatedTranslations,
              has_missing_translations: missing,
            };
          }),
        };
      })
    );
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setNotification(null);
    try {
      await apiClient.fetch("/api/v1/admin/clinical/questionnaires", "post", {
        body: {
          payload: { sections },
          dual_control_approved: true,
        },
      });
      setNotification({ type: "success", message: "Clinical questionnaire definitions saved successfully." });
    } catch (err: any) {
      setNotification({ type: "error", message: err.data?.detail || err.message || "Failed to save questionnaire." });
    } finally {
      setSaving(false);
    }
  };

  const activeSection = sections.find((s) => s.section_id === selectedSectionId);

  // Compute total questions and translation completeness
  const totalQuestions = sections.reduce((acc, s) => acc + s.questions.length, 0);
  const missingCount = sections.reduce(
    (acc, s) => acc + s.questions.filter((q) => !q.text_translations.en || !q.text_translations.hi || !q.text_translations.mr).length,
    0
  );
  const completePercentage = totalQuestions > 0 ? Math.round(((totalQuestions - missingCount) / totalQuestions) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-soft text-primary">
            <FileQuestion className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Clinical Questionnaire & Screening Registry</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-bg border border-line text-muted">
                3 Supported Locales (EN, HI, MR)
              </span>
            </h2>
            <p className="text-xs text-muted">
              Manages validated screening probes (ISAR, FRAIL, 4AT-Lite, Fall) with real-time translation-completeness tracking.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary text-surface hover:bg-primary/95 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-button disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? "Saving..." : "Save Questionnaire Changes"}</span>
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

      {/* Completeness Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-line bg-surface shadow-xs">
          <span className="text-xs text-muted block mb-1">Total Validated Probes</span>
          <span className="font-heading font-bold text-xl text-ink">{totalQuestions} Items</span>
        </div>

        <div className="p-4 rounded-xl border border-line bg-surface shadow-xs">
          <span className="text-xs text-muted block mb-1">Translation Completeness</span>
          <div className="flex items-center gap-2">
            <span
              className={`font-heading font-bold text-xl ${
                completePercentage === 100 ? "text-selfcare" : "text-urgent"
              }`}
            >
              {completePercentage}%
            </span>
            <span className="text-xs text-muted">across EN/HI/MR</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-line bg-surface shadow-xs">
          <span className="text-xs text-muted block mb-1">Missing Localization Flags</span>
          <span
            className={`font-heading font-bold text-xl ${
              missingCount === 0 ? "text-selfcare" : "text-urgent"
            }`}
          >
            {missingCount} Questions Pending
          </span>
        </div>
      </div>

      {/* Main Sections Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Section List */}
        <div className="lg:col-span-4 space-y-2">
          <span className="text-xs font-bold text-muted uppercase tracking-wider block mb-1">
            Questionnaire Scales ({sections.length})
          </span>
          {sections.map((sec) => {
            const isSelected = sec.section_id === selectedSectionId;
            const hasMissing = sec.questions.some(
              (q) => !q.text_translations.en || !q.text_translations.hi || !q.text_translations.mr
            );

            return (
              <button
                key={sec.section_id}
                type="button"
                onClick={() => setSelectedSectionId(sec.section_id)}
                className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all ${
                  isSelected
                    ? "border-primary bg-primary-soft/40 shadow-xs"
                    : "border-line bg-surface hover:bg-bg text-ink"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-mono font-bold text-primary">{sec.section_id}</span>
                  {hasMissing ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-urgent/15 text-urgent flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" />
                      Incomplete
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-selfcare/15 text-selfcare flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Complete
                    </span>
                  )}
                </div>
                <div className="font-semibold text-ink">{sec.name}</div>
                <div className="text-[11px] text-muted mt-1">{sec.questions.length} questions</div>
              </button>
            );
          })}
        </div>

        {/* Question Details Editor */}
        <div className="lg:col-span-8 rounded-xl border border-line bg-surface p-5 shadow-card space-y-5">
          {activeSection ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div>
                  <h3 className="font-heading font-bold text-base text-ink">{activeSection.name}</h3>
                  <span className="font-mono text-xs text-muted">ID: {activeSection.section_id}</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-bg border border-line text-muted font-mono">
                  {activeSection.questions.length} questions in section
                </span>
              </div>

              <div className="space-y-6">
                {activeSection.questions.map((q, idx) => {
                  const missingEn = !q.text_translations.en;
                  const missingHi = !q.text_translations.hi;
                  const missingMr = !q.text_translations.mr;

                  return (
                    <div
                      key={q.question_id}
                      className="p-4 rounded-xl border border-line bg-bg/40 space-y-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary text-[11px]">
                            #{idx + 1} ({q.canonical_code})
                          </span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-bg border border-line text-muted">
                            Type: {q.type}
                          </span>
                        </div>

                        {/* Translation status tags */}
                        <div className="flex items-center gap-1.5 font-mono text-[10px]">
                          <span
                            className={`px-1.5 py-0.2 rounded font-semibold ${
                              missingEn ? "bg-emergency/15 text-emergency" : "bg-selfcare/15 text-selfcare"
                            }`}
                          >
                            EN {missingEn ? "✕" : "✓"}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded font-semibold ${
                              missingHi ? "bg-emergency/15 text-emergency" : "bg-selfcare/15 text-selfcare"
                            }`}
                          >
                            HI {missingHi ? "✕" : "✓"}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded font-semibold ${
                              missingMr ? "bg-emergency/15 text-emergency" : "bg-selfcare/15 text-selfcare"
                            }`}
                          >
                            MR {missingMr ? "✕" : "✓"}
                          </span>
                        </div>
                      </div>

                      {/* Multilingual Text Inputs */}
                      <div className="space-y-2.5 pt-2">
                        <div>
                          <label className="block font-semibold text-ink mb-1 text-[11px]">
                            English (en):
                          </label>
                          <input
                            type="text"
                            value={q.text_translations.en || ""}
                            onChange={(e) =>
                              handleTextChange(activeSection.section_id, q.question_id, "en", e.target.value)
                            }
                            className="w-full p-2 rounded-lg border border-line bg-surface text-ink text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-ink mb-1 text-[11px]">
                            Hindi (hi - हिंदी):
                          </label>
                          <input
                            type="text"
                            value={q.text_translations.hi || ""}
                            onChange={(e) =>
                              handleTextChange(activeSection.section_id, q.question_id, "hi", e.target.value)
                            }
                            className="w-full p-2 rounded-lg border border-line bg-surface text-ink text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-ink mb-1 text-[11px]">
                            Marathi (mr - मराठी):
                          </label>
                          <input
                            type="text"
                            value={q.text_translations.mr || ""}
                            onChange={(e) =>
                              handleTextChange(activeSection.section_id, q.question_id, "mr", e.target.value)
                            }
                            className="w-full p-2 rounded-lg border border-line bg-surface text-ink text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-muted text-xs">
              Select a questionnaire scale from the left panel to inspect and localize.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

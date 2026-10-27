"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { 
  LayoutGrid, 
  Save, 
  CheckCircle2, 
  RefreshCw, 
  User, 
  Eye, 
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";

const ALL_CARDS_PATIENT = [
  { id: "daily_checkin", label: "Daily Geriatric Check-In", desc: "Pain score, mood, home vitals, and chronic drift baseline tracking" },
  { id: "chat_companion", label: "Interactive Conversational Chat Companion", desc: "Geriatric conversational AI with cited ICMR guidelines" },
  { id: "medication_review", label: "Medication Safety & High-Risk Review", desc: "Beer's criteria & anticholinergic cognitive burden assessment" },
  { id: "summary_explainer", label: "Clinical Summary Plain-Language Explainer", desc: "Grade 6-8 plain language translation of clinician summaries" },
  { id: "visit_prep", label: "Doctor Visit Preparation Checklist", desc: "Dynamic question generator for upcoming clinical appointments" },
  { id: "emergency_card", label: "Emergency Red-Flag Warning Banner", desc: "Statutory 112 emergency escalation protocols" },
];

const ALL_INTAKE_SECTIONS_PATIENT = [
  { id: "simple_symptoms", label: "Chief Complaint & Duration", desc: "Primary symptom entry wizard" },
  { id: "home_vitals", label: "Home Vitals Entry", desc: "Optional blood pressure, pulse, SpO2 inputs" },
  { id: "micro_screens", label: "Geriatric Micro-Screen Surveys", desc: "Clinical frailty & cognitive baseline screening questions" },
];

const ALL_TOOLS_CLINICIAN = [
  { id: "queue", label: "Clinician Priority Worklist Queue", desc: "Priority-ordered triage queue sorted by severity and wait time" },
  { id: "case_detail", label: "Three-Pane Clinical Workspace", desc: "Patient context, triage overview, and vitals review" },
  { id: "differentials", label: "AI Differential Diagnoses & Feedback Loop", desc: "Accept, modify, or reject AI differentials with clinical rationale" },
  { id: "review_summary", label: "Clinician Summary & Decision Override", desc: "Final clinical decision-making and downgrade safeguards" },
  { id: "trends", label: "Historical Trends & Vitals Analytics", desc: "Multi-case vital drift and symptom recurrence charts" },
  { id: "audit_trail", label: "Explainability Audit Trail & Ensemble Votes", desc: "Full inspectability into rule-engine and AI model votes" },
];

export function PanelCompositionEditor() {
  const [selectedRole, setSelectedRole] = useState<string>("patient");
  const [visibleCards, setVisibleCards] = useState<string[]>([]);
  const [intakeSections, setIntakeSections] = useState<string[]>([]);
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [elderMode, setElderMode] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);

  const loadLayout = useCallback(async (role: string) => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/panel-layout", "get", {
        params: { role },
      });
      setVisibleCards(data.visible_cards || []);
      setIntakeSections(data.intake_sections || []);
      setDefaultLanguage(data.default_language || (role === "patient" ? "hi" : "en"));
      setElderMode(Boolean(data.elder_mode));
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load layout.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLayout(selectedRole);
  }, [selectedRole, loadLayout]);

  const toggleCard = (cardId: string) => {
    setVisibleCards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const toggleIntakeSection = (secId: string) => {
    setIntakeSections((prev) =>
      prev.includes(secId) ? prev.filter((id) => id !== secId) : [...prev, secId]
    );
  };

  const handleSaveConfirmed = async ({ reason }: { category: string; reason: string }) => {
    setSaving(true);
    setReasonDialogOpen(false);
    try {
      await apiClient.fetch("/api/v1/admin/panel-layout", "post", {
        body: {
          role: selectedRole,
          layout_config: {
            role: selectedRole,
            visible_cards: visibleCards,
            intake_sections: intakeSections,
            default_language: defaultLanguage,
            elder_mode: elderMode,
          },
          reason,
        },
      });

      setSuccessMsg(`Panel composition for role '${selectedRole}' published! Active screens reflect this immediately.`);
      loadLayout(selectedRole);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to update layout.");
    } finally {
      setSaving(false);
    }
  };

  const availableCards = selectedRole === "clinician" ? ALL_TOOLS_CLINICIAN : ALL_CARDS_PATIENT;

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-ink">
              Role-Based Panel Composition Editor
            </h3>
            <p className="text-xs text-muted">
              Configure which AI Hub cards, intake sections, and clinician tools are displayed for each user role in live UI.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-line bg-bg p-0.5 text-xs">
            {["patient", "caregiver", "clinician", "admin"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                className={`px-3 py-1 rounded-md font-semibold capitalize transition-all ${
                  selectedRole === r
                    ? "bg-primary text-surface shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setReasonDialogOpen(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-surface text-xs font-semibold hover:bg-primary-dark transition-all shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Publishing..." : "Publish Composition"}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
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

      {/* Cards Visibility Grid */}
      <div className="rounded-card border border-line bg-surface p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h4 className="font-heading font-semibold text-sm text-ink flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <span>Visible Tool Cards for Role: <strong className="font-mono text-primary uppercase">{selectedRole}</strong></span>
            </h4>
            <p className="text-xs text-muted">
              Select or deselect cards to dynamically show or hide them from {selectedRole}&apos;s interface.
            </p>
          </div>
          <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-bg border border-line text-muted">
            {visibleCards.length} of {availableCards.length} active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableCards.map((card) => {
            const isChecked = visibleCards.includes(card.id);

            return (
              <div
                key={card.id}
                onClick={() => toggleCard(card.id)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                  isChecked
                    ? "border-primary bg-primary-soft/10 text-ink shadow-2xs"
                    : "border-line bg-surface text-muted hover:border-line hover:text-ink"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCard(card.id)}
                  className="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-primary pointer-events-none"
                />
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-semibold text-xs text-ink">{card.label}</span>
                    <span className="font-mono text-[10px] text-muted">{card.id}</span>
                  </div>
                  <p className="text-xs text-muted">{card.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Intake Sections & UX Toggles (for Patient & Caregiver) */}
      {selectedRole !== "clinician" && selectedRole !== "admin" && (
        <div className="rounded-card border border-line bg-surface p-5 shadow-xs space-y-4">
          <div className="pb-3 border-b border-line">
            <h4 className="font-heading font-semibold text-sm text-ink">
              Intake Wizard Sections & Accessibility Modes
            </h4>
            <p className="text-xs text-muted">
              Configure intake form steps and default accessibility profile.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink">Intake Wizard Steps:</label>
              {ALL_INTAKE_SECTIONS_PATIENT.map((sec) => (
                <label
                  key={sec.id}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-line bg-bg text-xs cursor-pointer hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    checked={intakeSections.includes(sec.id)}
                    onChange={() => toggleIntakeSection(sec.id)}
                    className="h-3.5 w-3.5 rounded border-line text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-medium text-ink block">{sec.label}</span>
                    <span className="text-[11px] text-muted">{sec.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Default Interface Language:</label>
                <select
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-line bg-bg text-ink"
                >
                  <option value="en">English (Clinical standard)</option>
                  <option value="hi">हिन्दी (Hindi - Geriatric friendly)</option>
                  <option value="bn">বাংলা (Bengali)</option>
                  <option value="mr">मराठी (Marathi)</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                  <option value="te">తెలుగు (Telugu)</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-line bg-bg cursor-pointer hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={elderMode}
                    onChange={(e) => setElderMode(e.target.checked)}
                    className="h-4 w-4 rounded border-line text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-semibold text-xs text-ink block">Enable Default Elder Mode (सुगम मोड)</span>
                    <span className="text-[11px] text-muted">
                      Larger 18px body fonts, high contrast AAA tokens, and simplified single-question screens.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reason Dialog */}
      <ReasonDialog
        isOpen={reasonDialogOpen}
        title={`Publish Panel Composition: Role '${selectedRole}'`}
        actionDescription={`Updating visible UI cards and intake sections for role '${selectedRole}'. This directly alters what ${selectedRole}s see when logging into MediTriage.`}
        categories={[
          "Clinical Workflow Optimization",
          "Patient Intake Simplification",
          "Staged Capability Rollout",
        ]}
        minReasonLength={5}
        onConfirm={handleSaveConfirmed}
        onCancel={() => setReasonDialogOpen(false)}
      />
    </div>
  );
}

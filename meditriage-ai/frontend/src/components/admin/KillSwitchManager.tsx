"use client";

import { apiClient } from "@/lib/api/client";
import React, { useState, useEffect, useCallback } from "react";
import { 
  AlertOctagon, 
  Power, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  Info,
  Cpu,
  Bell,
  UserPlus,
  Edit,
  Mic
} from "lucide-react";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { ConfirmTypeToProceed } from "@/components/shared/ConfirmTypeToProceed";

interface KillSwitchMeta {
  key: string;
  name: string;
  active: boolean; // active = switch enabled (service running) or kill switch triggered
  icon: React.ComponentType<{ className?: string }>;
  degradationExplanation: string;
  warningSeverity: "critical" | "high" | "moderate";
}

const KNOWN_KILL_SWITCHES: Record<string, { label: string; icon: any; explanation: string; severity: "critical" | "high" | "moderate" }> = {
  "ai_inference": {
    label: "AI LLM Inference Subsystem",
    icon: Cpu,
    explanation: "This degrades external Gemini/OpenAI clinical AI inference to local deterministic rule-based engine v2.4 without service downtime. AI differentials & rationale will display fallback disclaimer.",
    severity: "critical",
  },
  "external_notifications": {
    label: "External SMS / WhatsApp / Email Dispatch",
    icon: Bell,
    explanation: "This degrades real-time SMS & email dispatch to purely in-app queued alerts. Patients and clinicians will not receive external carrier SMS until restored.",
    severity: "high",
  },
  "caregiver_invites": {
    label: "Caregiver Onboarding & Invitations",
    icon: UserPlus,
    explanation: "This disables creating new caregiver linkage requests. Existing active caregivers will continue to access authorized patient dashboards.",
    severity: "moderate",
  },
  "patient_revisions": {
    label: "Patient Case Self-Revisions",
    icon: Edit,
    explanation: "This blocks patients and caregivers from amending submitted intake cases. Clinicians retain full amendment and correction capabilities.",
    severity: "moderate",
  },
  "voice.enabled": {
    label: "Speech-to-Text & Voice Dictation",
    icon: Mic,
    explanation: "This degrades audio intake transcription to manual keyboard typing. Voice recording prompts in intake wizard v2 will be gracefully hidden.",
    severity: "moderate",
  },
};

export function KillSwitchManager() {
  const [switches, setSwitches] = useState<{ switch_key: string; active: boolean; description?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Toggle Flow State
  const [targetSwitch, setTargetSwitch] = useState<{ key: string; willEnable: boolean } | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [confirmTypeOpen, setConfirmTypeOpen] = useState(false);
  const [collectedReason, setCollectedReason] = useState("");

  const loadKillSwitches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiClient.fetch("/api/v1/admin/kill-switches", "get");
      setSwitches(data.kill_switches || []);
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to load kill switches.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKillSwitches();
  }, [loadKillSwitches]);

  const handleToggleClick = (switchKey: string, currentlyActive: boolean) => {
    setTargetSwitch({
      key: switchKey,
      willEnable: !currentlyActive,
    });
    setReasonDialogOpen(true);
  };

  const handleReasonConfirmed = ({ reason }: { category: string; reason: string }) => {
    setCollectedReason(reason);
    setReasonDialogOpen(false);
    // If disabling a critical switch (degrading system), show ConfirmTypeToProceed
    if (targetSwitch && !targetSwitch.willEnable) {
      setConfirmTypeOpen(true);
    } else {
      executeToggle(reason);
    }
  };

  const executeToggle = async (reasonToUse?: string) => {
    if (!targetSwitch) return;
    const reason = reasonToUse || collectedReason;
    try {
      await apiClient.fetch("/api/v1/admin/kill-switches/{name}/toggle", "post", {
        pathParams: { name: targetSwitch.key },
        body: {
          enabled: targetSwitch.willEnable,
          reason,
        },
      });

      setSuccessMsg(
        `Kill switch '${targetSwitch.key}' toggled to ${targetSwitch.willEnable ? "ONLINE / ACTIVE" : "DISABLED / DEGRADED"}.`
      );
      loadKillSwitches();
    } catch (err: any) {
      setError(err.data?.detail || err.message || "Failed to toggle switch.");
    } finally {
      setTargetSwitch(null);
      setConfirmTypeOpen(false);
    }
  };

  // Build full list merging known metadata with backend response
  const fullSwitchList = Object.entries(KNOWN_KILL_SWITCHES).map(([key, meta]) => {
    const backendItem = switches.find((s) => s.switch_key === key);
    return {
      key,
      name: meta.label,
      active: backendItem ? backendItem.active : true, // default active
      icon: meta.icon,
      degradationExplanation: meta.explanation,
      warningSeverity: meta.severity,
    };
  });

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="rounded-card border-2 border-emergency/30 bg-surface p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emergency/10 text-emergency flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2">
              <span>Emergency Operational Kill Switches</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emergency/10 text-emergency font-bold">
                CIRCUIT BREAKERS
              </span>
            </h3>
            <p className="text-xs text-muted">
              Instantly shed load or isolate failing external providers during severe outages. Every action provides explicit graceful degradation.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadKillSwitches}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-bg hover:bg-surface text-xs font-medium text-ink transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh States</span>
        </button>
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

      {/* Kill Switches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fullSwitchList.map((item) => {
          const Icon = item.icon;
          const isOperational = item.active;

          return (
            <div
              key={item.key}
              className={`rounded-card border p-5 shadow-xs transition-all flex flex-col justify-between space-y-4 ${
                isOperational
                  ? "border-line bg-surface"
                  : "border-emergency/40 bg-emergency/5"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isOperational
                          ? "bg-primary-soft text-primary"
                          : "bg-emergency/15 text-emergency"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-heading font-semibold text-sm text-ink">
                        {item.name}
                      </h4>
                      <span className="font-mono text-[10px] text-muted">{item.key}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isOperational
                        ? "bg-selfcare/10 text-selfcare border border-selfcare/20"
                        : "bg-emergency/20 text-emergency border border-emergency/30"
                    }`}
                  >
                    {isOperational ? "OPERATIONAL" : "KILL-SWITCH TRIGGERED"}
                  </span>
                </div>

                {/* Visible "Degrades X to Y" Explanation */}
                <div className="p-3 rounded-lg border border-line/70 bg-bg text-xs space-y-1">
                  <div className="flex items-center gap-1 text-ink font-semibold text-[11px]">
                    <Info className="w-3.5 h-3.5 text-primary" />
                    <span>Degradation Contract:</span>
                  </div>
                  <p className="text-muted leading-relaxed">
                    {item.degradationExplanation}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-line/60 flex items-center justify-between">
                <span className="text-[11px] text-muted">
                  {isOperational ? "Click to degrade/isolate" : "Click to restore online"}
                </span>

                <button
                  type="button"
                  onClick={() => handleToggleClick(item.key, item.active)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
                    isOperational
                      ? "bg-emergency/10 border border-emergency/20 text-emergency hover:bg-emergency/20"
                      : "bg-selfcare text-white hover:bg-selfcare/90"
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{isOperational ? "Trip Kill Switch" : "Restore Subsystem"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reason Dialog */}
      <ReasonDialog
        isOpen={reasonDialogOpen}
        title={`Kill Switch Action: '${targetSwitch?.key}'`}
        actionDescription={
          targetSwitch?.willEnable
            ? `Restoring normal operational traffic to subsystem '${targetSwitch?.key}'.`
            : `TRIPPING EMERGENCY KILL SWITCH for '${targetSwitch?.key}'. This initiates graceful degradation protocol.`
        }
        categories={[
          "Emergency Upstream Outage / Provider Degradation",
          "High Latency / AI Quota Exhaustion Load Shedding",
          "Security / Data Privacy Breach Quarantine",
          "Scheduled Maintenance Testing",
        ]}
        minReasonLength={5}
        onConfirm={handleReasonConfirmed}
        onCancel={() => setReasonDialogOpen(false)}
      />

      {/* Type To Confirm for Tripping Kill Switch */}
      <ConfirmTypeToProceed
        isOpen={confirmTypeOpen}
        title={`Confirm Trip Kill Switch: ${targetSwitch?.key}`}
        warningMessage={`You are about to TRIP the kill switch for '${targetSwitch?.key}'. Subsystem functionality will immediately degrade according to the published SLA contract.`}
        expectedWord="DEGRADE"
        confirmButtonText="Trip Kill Switch & Degrade"
        onConfirm={() => executeToggle()}
        onCancel={() => setConfirmTypeOpen(false)}
      />
    </div>
  );
}

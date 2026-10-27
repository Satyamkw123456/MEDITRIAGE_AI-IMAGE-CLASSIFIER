'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { AlertOctagon, AlertTriangle, X, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';

interface EmergencyDowngradeOverrideDialogProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: number;
  currentLevel: string;
  onSuccess: (newLevel: string) => void;
}

export const EmergencyDowngradeOverrideDialog: React.FC<EmergencyDowngradeOverrideDialogProps> = ({
  isOpen,
  onClose,
  caseId,
  currentLevel,
  onSuccess,
}) => {
  const [targetLevel, setTargetLevel] = useState<string>('Urgent');
  const [reason, setReason] = useState<string>('');
  const [confirmedEmergencyDowngrade, setConfirmedEmergencyDowngrade] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isCurrentEmergency = currentLevel.trim().toLowerCase() === 'emergency';
  const isTargetEmergency = targetLevel.trim().toLowerCase() === 'emergency';
  const isEmergencyDowngrade = isCurrentEmergency && !isTargetEmergency;

  const minChars = isEmergencyDowngrade ? 20 : 10;
  const currentChars = reason.trim().length;
  const hasSufficientChars = currentChars >= minChars;
  const canSubmit = isEmergencyDowngrade
    ? confirmedEmergencyDowngrade && hasSufficientChars
    : hasSufficientChars;

  useEffect(() => {
    if (isOpen) {
      // Default target level: if current is Emergency, default to Urgent, else Urgent
      setTargetLevel(isCurrentEmergency ? 'Urgent' : 'Emergency');
      setReason('');
      setConfirmedEmergencyDowngrade(false);
      setServerError(null);
    }
  }, [isOpen, isCurrentEmergency]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setServerError(null);

    try {
      await apiClient.fetch('/api/v1/cases/{case_id}/override-triage', 'post', {
        pathParams: { case_id: caseId },
        body: {
          new_triage_level: targetLevel,
          reason: reason.trim(),
          confirm_emergency_downgrade: isEmergencyDowngrade ? confirmedEmergencyDowngrade : false,
        },
      });

      onSuccess(targetLevel);
      onClose();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Override failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-surface rounded-2xl border border-line shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className={`p-5 flex items-center justify-between border-b ${isEmergencyDowngrade ? 'bg-emergency/10 border-emergency/30' : 'bg-primary-soft border-line'}`}>
          <div className="flex items-center gap-3">
            {isEmergencyDowngrade ? (
              <div className="p-2 bg-emergency text-surface rounded-lg">
                <AlertOctagon className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-primary text-surface rounded-lg">
                <ShieldAlert className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 id="override-dialog-title" className="text-lg font-bold text-ink">
                {isEmergencyDowngrade ? 'Emergency Downgrade Override' : 'Override Triage Level'}
              </h2>
              <p className="text-xs text-muted">
                Case #{caseId} • Current Level: <span className="font-semibold text-ink">{currentLevel}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-line transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {serverError && (
            <div className="p-3.5 bg-emergency/10 border border-emergency/30 rounded-xl flex items-start gap-2.5 text-emergency text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Override Failed</p>
                <p className="text-xs mt-0.5">{serverError}</p>
              </div>
            </div>
          )}

          {/* Target Level Selection */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Target Triage Level</label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { level: 'Emergency', color: 'border-emergency text-emergency' },
                { level: 'Urgent', color: 'border-urgent text-urgent' },
                { level: 'Routine', color: 'border-routine text-routine' },
                { level: 'Self-Care Info', color: 'border-selfcare text-selfcare' },
              ].map((item) => (
                <button
                  key={item.level}
                  type="button"
                  onClick={() => setTargetLevel(item.level)}
                  className={`p-3 rounded-xl border text-sm font-bold text-left transition-all ${
                    targetLevel === item.level
                      ? 'ring-2 ring-primary border-primary bg-primary-soft shadow-sm'
                      : 'border-line hover:border-muted text-ink bg-surface'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{item.level}</span>
                    {targetLevel === item.level && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* High-Risk Emergency Downgrade Warning */}
          {isEmergencyDowngrade && (
            <div className="p-4 bg-emergency/10 border border-emergency/40 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertOctagon className="w-5 h-5 text-emergency shrink-0 mt-0.5" />
                <div className="text-xs text-ink space-y-1">
                  <p className="font-bold text-emergency uppercase tracking-wider">
                    High Risk Clinical Action Required
                  </p>
                  <p>
                    You are downgrading a case classified as <strong>Emergency</strong>. This override will supersede red-flag safety rules and be permanently logged to the audit ledger.
                  </p>
                </div>
              </div>

              {/* Double Confirmation Checkbox */}
              <label className="flex items-start gap-3 pt-2 border-t border-emergency/20 cursor-pointer">
                <input
                  type="checkbox"
                  id="confirm-emergency-downgrade-checkbox"
                  checked={confirmedEmergencyDowngrade}
                  onChange={(e) => setConfirmedEmergencyDowngrade(e.target.checked)}
                  className="w-5 h-5 rounded border-emergency text-emergency focus:ring-emergency mt-0.5"
                />
                <span className="text-xs font-semibold text-ink leading-snug">
                  I confirm that I have evaluated the patient, declare that acute emergency escalation is not indicated, and accept clinical responsibility.
                </span>
              </label>
            </div>
          )}

          {/* Clinical Reason Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="override-reason-textarea" className="text-sm font-semibold text-ink">
                Mandatory Clinical Rationale
              </label>
              <span
                className={`text-xs font-mono ${
                  hasSufficientChars ? 'text-selfcare font-semibold' : 'text-emergency'
                }`}
              >
                {currentChars} / {minChars} chars minimum
              </span>
            </div>
            <textarea
              id="override-reason-textarea"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isEmergencyDowngrade
                  ? "Detail clinical rationale: patient vital signs, absence of acute ischemia, confirmed stable status..."
                  : "State clinical reason for updating triage tier..."
              }
              className="w-full p-3.5 rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-primary text-sm text-ink resize-none placeholder:text-muted/60"
            />
            {!hasSufficientChars && (
              <p className="text-xs text-emergency mt-1">
                Please provide at least {minChars - currentChars} more character{minChars - currentChars === 1 ? '' : 's'}.
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-line text-sm font-semibold text-ink hover:bg-line/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              id="submit-override-button"
              className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                canSubmit && !submitting
                  ? isEmergencyDowngrade
                    ? 'bg-emergency text-surface hover:brightness-110 shadow-md shadow-emergency/20'
                    : 'bg-primary text-surface hover:brightness-110 shadow-md shadow-primary/20'
                  : 'bg-line text-muted cursor-not-allowed'
              }`}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEmergencyDowngrade ? 'Confirm Emergency Downgrade' : 'Apply Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

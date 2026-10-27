"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { 
  ShieldAlert, 
  AlertTriangle, 
  Pill, 
  Heart, 
  Phone, 
  Clock, 
  ShieldCheck, 
  AlertOctagon,
  Activity,
  Calendar
} from "lucide-react";

interface PublicCardData {
  card_id: number;
  status: string;
  expires_at: string;
  medications: string[];
  baseline_summary: string;
  allergies: string[];
  blood_group: string;
  caregiver_contact: {
    name: string;
    phone: string;
    relationship: string;
  };
  emergency_notice: string;
}

export default function PublicEmergencyCardPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [card, setCard] = useState<PublicCardData | null>(null);

  useEffect(() => {
    const fetchCard = async () => {
      setLoading(true);
      setErrorStatus(null);
      try {
        const data: any = await apiClient.fetch("/api/v1/public/emergency-card/{token}", "get", {
          pathParams: { token },
        });
        setCard(data);
      } catch (err: any) {
        setErrorStatus(err.status || 500);
        setCard(null);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchCard();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-lg p-8 rounded-2xl border border-line bg-surface text-center space-y-3">
          <Activity className="w-8 h-8 text-emergency animate-pulse mx-auto" />
          <h2 className="text-sm font-semibold text-ink">Decentralized Medical ID Lookup...</h2>
          <p className="text-xs text-muted">Verifying cryptographic signature and expiration status.</p>
        </div>
      </div>
    );
  }

  // Handle Expired, Revoked, or Invalid Card (HTTP 404 / 429)
  if (errorStatus === 404 || !card) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-lg p-6 sm:p-8 rounded-2xl border border-emergency/30 bg-surface shadow-md space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emergency/10 border border-emergency/30 text-emergency flex items-center justify-center mx-auto">
            <AlertOctagon className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h1 className="font-heading font-bold text-xl sm:text-2xl text-ink">
              Emergency Card Expired or Inactive
            </h1>
            <p className="text-xs text-muted max-w-md mx-auto">
              This emergency medical profile has either expired, been revoked by the patient, or is invalid. No patient data is accessible via this QR token.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-emergency/5 border border-emergency/20 text-left space-y-2">
            <span className="text-xs font-bold text-emergency uppercase tracking-wider block">
              Emergency Responder Guidance
            </span>
            <p className="text-xs text-ink">
              Proceed with standard emergency medical evaluation. In acute distress, initiate immediate resuscitation or call local dispatch:
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              <a
                href="tel:112"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emergency text-surface text-xs font-bold shadow-xs hover:bg-emergency/90"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call 112 (National Dispatch)</span>
              </a>
              <a
                href="tel:108"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-line hover:bg-bg text-ink text-xs font-semibold shadow-xs"
              >
                <Phone className="w-3.5 h-3.5 text-primary" />
                <span>Call 108 (PMC Ambulance)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Valid Emergency Card View
  return (
    <div className="min-h-screen bg-bg py-6 px-4 sm:px-6">
      <div className="w-full max-w-xl mx-auto space-y-4">
        {/* Top Emergency Red Banner */}
        <div className="p-4 rounded-2xl bg-emergency text-surface flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <div>
              <span className="text-[10px] font-mono tracking-widest uppercase opacity-85 block">
                Official Paramedic View
              </span>
              <h1 className="font-heading font-bold text-base sm:text-lg leading-tight">
                Emergency Medical Profile
              </h1>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface text-emergency font-bold text-xs shadow-xs">
              <ShieldCheck className="w-3 h-3 text-emergency" />
              <span>Verified Active</span>
            </span>
          </div>
        </div>

        {/* Quick Critical Summary Bar */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl border border-line bg-surface shadow-xs">
            <span className="text-[11px] font-semibold text-muted block">Blood Group</span>
            <span className="font-heading font-extrabold text-2xl text-emergency">
              {card.blood_group || "Unknown"}
            </span>
          </div>
          <div className="p-3.5 rounded-xl border border-line bg-surface shadow-xs">
            <span className="text-[11px] font-semibold text-muted block">Profile Expiration</span>
            <span className="text-xs font-semibold text-ink flex items-center gap-1 mt-1">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>
                {new Date(card.expires_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </span>
          </div>
        </div>

        {/* Critical Alerts & Baseline Flags */}
        <div className="p-4 rounded-xl bg-emergency/10 border-2 border-emergency/40 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-emergency uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>High-Risk Clinical Flags & Baseline</span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-ink leading-relaxed">
            {card.baseline_summary}
          </p>
        </div>

        {/* Severe Documented Allergies */}
        <div className="p-4 rounded-xl border border-line bg-surface shadow-xs space-y-2">
          <span className="text-xs font-bold text-ink uppercase tracking-wider block">
            Severe Drug & Substance Allergies
          </span>
          {card.allergies.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {card.allergies.map((allergy, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emergency/15 text-emergency border border-emergency/30"
                >
                  {allergy}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted">No known drug allergies reported.</span>
          )}
        </div>

        {/* Current Medications (Generic Formulations) */}
        <div className="p-4 rounded-xl border border-line bg-surface shadow-xs space-y-2">
          <div className="flex items-center gap-1.5">
            <Pill className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Active Medications (Generic Names)
            </span>
          </div>
          <div className="divide-y divide-line text-xs">
            {card.medications.map((med, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{med}</span>
                <span className="text-[10px] text-muted">Prescribed Generic</span>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Proxy Contact */}
        {card.caregiver_contact && (
          <div className="p-4 rounded-xl border border-primary/30 bg-primary-soft/50 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-surface flex items-center justify-center shrink-0 shadow-xs">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider block">
                  Designated Emergency Proxy
                </span>
                <span className="font-bold text-sm text-ink block">
                  {card.caregiver_contact.name} ({card.caregiver_contact.relationship})
                </span>
                <span className="text-xs text-muted font-mono">{card.caregiver_contact.phone}</span>
              </div>
            </div>

            <a
              href={`tel:${card.caregiver_contact.phone}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-surface text-xs font-bold shadow-xs hover:bg-primary-hover transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span>Call Proxy Now</span>
            </a>
          </div>
        )}

        {/* Privacy Notice */}
        <div className="p-3 rounded-lg bg-surface border border-line text-center text-[11px] text-muted">
          <span>{card.emergency_notice}</span>
        </div>
      </div>
    </div>
  );
}

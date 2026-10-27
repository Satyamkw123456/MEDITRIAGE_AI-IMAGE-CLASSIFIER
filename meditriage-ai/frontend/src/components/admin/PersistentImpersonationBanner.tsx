"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, StopCircle, Clock, Eye } from "lucide-react";
import { apiClient } from "@/lib/api/client";

export function PersistentImpersonationBanner() {
  const [token, setToken] = useState<string | null>(null);
  const [ticketRef, setTicketRef] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const checkStorage = () => {
      const storedToken = localStorage.getItem("impersonation_token");
      const storedTicket = localStorage.getItem("impersonation_ticket_ref");
      const storedExpires = localStorage.getItem("impersonation_expires_at");
      setToken(storedToken);
      setTicketRef(storedTicket);
      setExpiresAt(storedExpires);

      if (storedExpires) {
        const diff = Math.max(0, Math.floor((new Date(storedExpires).getTime() - Date.now()) / 1000));
        setSecondsLeft(diff);
      }
    };

    checkStorage();
    const interval = setInterval(checkStorage, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleEndSession = async () => {
    const sessionId = localStorage.getItem("impersonation_session_id");
    if (sessionId) {
      try {
        await apiClient.fetch("/api/v1/admin/support/impersonate/{session_id}/stop", "post", {
          pathParams: { session_id: parseInt(sessionId, 10) },
        });
      } catch {
        // Fallback
      }
    }
    localStorage.removeItem("impersonation_token");
    localStorage.removeItem("impersonation_session_id");
    localStorage.removeItem("impersonation_ticket_ref");
    localStorage.removeItem("impersonation_expires_at");
    setToken(null);
    window.location.reload();
  };

  if (!token) return null;

  const minutes = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
  const seconds = secondsLeft !== null ? secondsLeft % 60 : 0;

  return (
    <aside
      id="persistent-impersonation-banner"
      aria-label="Active impersonation session status"
      className="sticky top-0 z-50 w-full bg-emergency text-surface px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 border-b-2 border-emergency/90 text-xs font-semibold"
    >
      <div className="flex items-center gap-2.5">
        <ShieldAlert className="w-5 h-5 animate-pulse shrink-0" />
        <div>
          <span className="font-heading uppercase tracking-wider font-bold">
            IMPERSONATION ACTIVE (HARD READ-ONLY MODE)
          </span>
          <span className="mx-2 opacity-70">|</span>
          <span className="font-mono opacity-90">Ticket: {ticketRef || "SUPPORT-SESSION"}</span>
          <span className="mx-2 opacity-70">|</span>
          <span className="text-[11px] opacity-80">All writes and mutations are strictly blocked (403)</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {secondsLeft !== null && (
          <div className="flex items-center gap-1.5 font-mono text-xs bg-surface/20 px-2.5 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {minutes}:{seconds < 10 ? `0${seconds}` : seconds} TTL remaining
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={handleEndSession}
          className="px-3 py-1 rounded-lg bg-surface text-emergency font-bold hover:bg-surface/90 text-xs flex items-center gap-1 transition-colors shadow-xs"
        >
          <StopCircle className="w-3.5 h-3.5" />
          <span>End Impersonation</span>
        </button>
      </div>
    </aside>
  );
}

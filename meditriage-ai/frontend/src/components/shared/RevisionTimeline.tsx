"use client";

import React, { useState } from "react";
import { 
  GitCommit, 
  User, 
  Clock, 
  FileText, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  ShieldCheck
} from "lucide-react";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  category?: string;
  isOverride?: boolean;
}

interface RevisionTimelineProps {
  events: TimelineEvent[];
  title?: string;
  className?: string;
}

export function RevisionTimeline({
  events,
  title = "Audit & Revision History",
  className = "",
}: RevisionTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section 
      aria-label={title}
      className={`rounded-card border border-line bg-surface p-5 shadow-card ${className}`}
    >
      <div className="flex items-center justify-between pb-4 border-b border-line mb-6">
        <div className="flex items-center gap-2">
          <GitCommit className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="font-heading font-semibold text-lg text-ink">{title}</h3>
        </div>
        <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-primary-soft text-primary border border-primary/20">
          {events.length} revisions logged
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8 text-muted">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recorded revision events for this record.</p>
        </div>
      ) : (
        <ol className="relative border-l-2 border-line/80 ml-3 space-y-6">
          {events.map((evt) => {
            const isExpanded = expandedIds.has(evt.id);
            const hasDetails = evt.previousValue || evt.newValue || evt.reason;

            return (
              <li key={evt.id} className="relative pl-6">
                {/* Node icon */}
                <div 
                  className={`absolute -left-[17px] top-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-surface shadow-sm ${
                    evt.isOverride 
                      ? "border-emergency text-emergency" 
                      : "border-primary text-primary"
                  }`}
                  aria-hidden="true"
                >
                  {evt.isOverride ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                </div>

                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading font-medium text-sm text-ink">
                      {evt.action}
                    </span>
                    {evt.isOverride && (
                      <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-emergency/10 text-emergency border border-emergency/20">
                        Clinical Override
                      </span>
                    )}
                    {evt.category && (
                      <span className="text-xs px-2 py-0.5 rounded bg-bg text-muted border border-line">
                        {evt.category}
                      </span>
                    )}
                  </div>
                  <time className="text-xs text-muted font-mono whitespace-nowrap">
                    {evt.timestamp}
                  </time>
                </div>

                <p className="text-sm text-ink/90 mt-1">{evt.summary}</p>

                <div className="flex items-center gap-3 text-xs text-muted mt-2">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <User className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                    {evt.actorName}
                  </span>
                  <span>•</span>
                  <span className="font-mono bg-bg px-1.5 py-0.5 rounded border border-line text-[11px]">
                    {evt.actorRole}
                  </span>
                </div>

                {/* Collapsible detail / diff view */}
                {hasDetails && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(evt.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          Hide delta & justification
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          Show delta & justification
                        </>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-2 rounded-lg border border-line bg-bg/60 p-3 text-xs">
                        {evt.reason && (
                          <div>
                            <span className="font-semibold text-muted block mb-0.5">Mandatory Reason:</span>
                            <blockquote className="border-l-2 border-primary/50 pl-2 italic text-ink">
                              &ldquo;{evt.reason}&rdquo;
                            </blockquote>
                          </div>
                        )}

                        {(evt.previousValue || evt.newValue) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-line/60">
                            {evt.previousValue && (
                              <div className="p-2 rounded bg-surface border border-emergency/20 text-ink">
                                <span className="text-[10px] font-mono uppercase text-emergency font-bold block mb-1">
                                  Previous Value
                                </span>
                                <code className="block font-mono text-[11px] whitespace-pre-wrap break-words">
                                  {evt.previousValue}
                                </code>
                              </div>
                            )}
                            {evt.newValue && (
                              <div className="p-2 rounded bg-surface border border-selfcare/20 text-ink">
                                <span className="text-[10px] font-mono uppercase text-selfcare font-bold block mb-1">
                                  New Value
                                </span>
                                <code className="block font-mono text-[11px] whitespace-pre-wrap break-words">
                                  {evt.newValue}
                                </code>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

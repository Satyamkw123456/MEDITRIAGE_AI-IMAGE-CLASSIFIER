"use client";

/**
 * SkinImagePanel — upload a skin/wound photo to a case and show the two-agent analysis
 * (Descriptor + Severity) with confidence, rules fired and the pipeline flow.
 * Advisory only: the clinician remains the decision-maker.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, ImagePlus, Loader2, ShieldAlert, Info, TrendingUp, Eye } from "lucide-react";
import { apiClient, ApiError, type SkinAnalysis, type SkinStatus } from "@/lib/api/client";
import { AgentFlowViewer } from "./AgentFlowViewer";

const BODY_PARTS = ["face", "scalp", "neck", "chest", "back", "abdomen", "arm", "hand", "leg", "foot", "groin", "nails", "other"];
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

const LEVEL_STYLE: Record<string, string> = {
  Emergency: "bg-emergency-soft text-emergency border-emergency",
  Urgent: "bg-urgent-soft text-urgent border-urgent",
  Routine: "bg-routine-soft text-routine border-routine",
  "Self-Care Info": "bg-selfcare-soft text-selfcare border-selfcare",
};
const SEV_STYLE = ["", "bg-selfcare", "bg-routine", "bg-urgent", "bg-urgent", "bg-emergency"];

function SeverityMeter({ score, label }: { score: number; label: string }) {
  return (
    <div role="meter" aria-valuemin={1} aria-valuemax={5} aria-valuenow={score} aria-label={label}>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`h-2.5 flex-1 rounded-full ${i <= score ? SEV_STYLE[score] : "bg-line"}`} />
        ))}
      </div>
      <p className="mt-1 text-sm font-semibold text-ink">{score} / 5</p>
    </div>
  );
}

export function SkinImagePanel({ caseId, canUpload = true }: { caseId: number; canUpload?: boolean }) {
  const t = useTranslations("Skin");
  const [status, setStatus] = useState<SkinStatus | null>(null);
  const [items, setItems] = useState<SkinAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [bodyPart, setBodyPart] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [thumb, setThumb] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [s, list] = await Promise.all([apiClient.skin.status(), apiClient.skin.list(caseId)]);
      setStatus(s as SkinStatus);
      setItems(list as SkinAnalysis[]);
      setSelected(0);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const current = items[selected];
  useEffect(() => {
    let revoked: string | null = null;
    let alive = true;
    setThumb(null);
    if (current) {
      apiClient.skin
        .imageBlobUrl(caseId, current.id)
        .then((u) => {
          if (alive) {
            revoked = u;
            setThumb(u);
          } else URL.revokeObjectURL(u);
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [caseId, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (f: File | null) => {
    setError(null);
    if (!f) return;
    if (!ALLOWED.includes(f.type)) return setError(t("badType"));
    if (status && f.size > status.max_upload_bytes) return setError(t("tooLarge", { mb: Math.floor(status.max_upload_bytes / 1_000_000) }));
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const created = await apiClient.skin.analyze(caseId, file, bodyPart || undefined);
      setItems((prev) => [created, ...prev]);
      setSelected(0);
      setFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      const detail = e instanceof ApiError && typeof e.data?.detail === "string" ? e.data.detail : null;
      setError(detail || t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="skin-title" className="rounded-card border border-line bg-surface p-5 sm:p-6 shadow-card space-y-5">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary-soft p-2.5 text-primary"><Camera className="w-5 h-5" aria-hidden /></div>
        <div>
          <h3 id="skin-title" className="font-heading font-bold text-lg text-ink">{t("title")}</h3>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> {t("loading")}
        </div>
      )}

      {loadError && (
        <div role="alert" className="rounded-lg border border-line bg-bg p-4 text-sm">
          <p className="text-ink">{t("loadFailed")}</p>
          <button onClick={load} className="mt-2 font-semibold text-primary underline">{t("retry")}</button>
        </div>
      )}

      {!loading && !loadError && status && !status.classifier_available && (
        <div className="flex gap-2 rounded-lg border border-line bg-primary-soft p-3 text-sm text-ink">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden />
          <p>{t("classifierUnavailable")}</p>
        </div>
      )}

      {!loading && !loadError && canUpload && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="skin-file" className="block text-sm font-semibold text-ink mb-1">{t("choosePhoto")}</label>
                <input
                  id="skin-file"
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:font-semibold file:text-primary"
                />
              </div>
              <div>
                <label htmlFor="skin-body" className="block text-sm font-semibold text-ink mb-1">{t("bodyPart")}</label>
                <select
                  id="skin-body"
                  value={bodyPart}
                  onChange={(e) => setBodyPart(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                >
                  <option value="">{t("bodyPartPlaceholder")}</option>
                  {BODY_PARTS.map((k) => (
                    <option key={k} value={k}>{t(`bp.${k}`)}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={submit}
              disabled={!file || busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-surface hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <ImagePlus className="w-4 h-4" aria-hidden />}
              {busy ? t("analyzing") : t("analyze")}
            </button>
          </div>
          {preview ? (
            <div className="relative w-48 h-48 rounded-xl border-2 border-primary/50 overflow-hidden bg-bg shadow-sm">
              {/* CSS-only 2D Framing Guide Overlay */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={t("previewAlt")} className="w-full h-full object-cover" />
              <div className="absolute inset-3 border-2 border-dashed border-surface/90 rounded-lg pointer-events-none flex items-center justify-center">
                <span className="text-[10px] font-mono text-surface font-semibold bg-ink/70 px-1.5 py-0.5 rounded backdrop-blur-xs">
                  Target Centered
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-line bg-bg text-xs text-muted space-y-1">
              <p className="font-semibold text-ink flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-primary" /> Photography Guidance:
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Ensure bright, indirect natural lighting without heavy shadows or glare.</li>
                <li>Hold phone ~15–20 cm away and center the affected lesion within frame.</li>
                <li>Photo capture is strictly encrypted &amp; stored under DPDP Act 2023 principles.</li>
              </ul>
            </div>
          )}
          <p className="text-xs text-muted">{t("privacy")}</p>
          {error && <p role="alert" className="text-sm font-semibold text-emergency">{error}</p>}
        </div>
      )}

      {!loading && !loadError && items.length === 0 && (
        <p className="text-sm text-muted">{t("empty")}</p>
      )}

      {current && (
        <div className="space-y-4 border-t border-line pt-5">
          {items.length > 1 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("history")}>
              {items.map((it, i) => (
                <button
                  key={it.id}
                  role="tab"
                  aria-selected={i === selected}
                  onClick={() => setSelected(i)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${i === selected ? "border-primary bg-primary-soft text-primary" : "border-line text-muted"}`}
                >
                  #{items.length - i} · {new Date(it.created_at).toLocaleDateString()}
                </button>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-[160px_1fr] gap-5">
            <div>
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt={t("imageAlt")} className="w-40 h-40 rounded-xl border border-line object-cover" />
              ) : (
                <div className="w-40 h-40 rounded-xl border border-line bg-bg" aria-hidden />
              )}
              {current.body_part && <p className="mt-1 text-xs text-muted">{t(`bp.${current.body_part}` as never)}</p>}
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${LEVEL_STYLE[current.suggested_triage_level] || "border-line"}`}>
                  {t(`level.${current.suggested_triage_level}` as never)}
                </span>
                <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink">
                  {t("confidence")}: {t(`band.${current.confidence_band}` as never)}
                </span>
                {current.requires_clinician_review && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-urgent bg-urgent-soft px-3 py-1 text-xs font-bold text-urgent">
                    <Eye className="w-3.5 h-3.5" aria-hidden /> {t("reviewRequired")}
                  </span>
                )}
                {current.escalation_applied && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
                    <TrendingUp className="w-3.5 h-3.5" aria-hidden /> {t("escalated")}
                  </span>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-ink mb-1">{t("severity")}</p>
                <SeverityMeter score={current.severity_score} label={t("severity")} />
              </div>

              {current.recommendation && (
                <p className="text-sm text-ink rounded-lg bg-bg border border-line p-3">{current.recommendation}</p>
              )}
              {current.description && <p className="text-sm text-muted">{current.description}</p>}
            </div>
          </div>

          {current.severity_reasons.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-ink mb-1.5">{t("why")}</h4>
              <ul className="list-disc pl-5 text-sm text-ink space-y-1">
                {current.severity_reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {current.predictions.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-ink mb-1.5">{t("matches")}</h4>
              <ul className="space-y-2">
                {current.predictions.slice(0, 3).map((p) => (
                  <li key={p.class_index} className="text-sm">
                    <div className="flex justify-between gap-3 text-ink"><span>{p.label}</span><span className="font-semibold">{Math.round(p.confidence * 100)}%</span></div>
                    <div className="h-1.5 rounded-full bg-line"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.round(p.confidence * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {current.relevant_conditions.length > 0 && (
            <details className="rounded-lg border border-line p-3">
              <summary className="cursor-pointer text-sm font-bold text-ink">{t("background")}</summary>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {current.relevant_conditions.map((c) => (
                  <li key={c.id}><span className="font-semibold text-ink">{c.id}.</span> {c.data}</li>
                ))}
              </ul>
            </details>
          )}

          {current.trace && (
            <details className="rounded-lg border border-line p-3">
              <summary className="cursor-pointer text-sm font-bold text-ink">{t("flowTitle")}</summary>
              <div className="mt-3"><AgentFlowViewer trace={current.trace as never} title={t("flowTitle")} /></div>
            </details>
          )}

          <p className="flex gap-2 text-xs text-muted">
            <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden /> {t("disclaimer")}
          </p>
        </div>
      )}
    </section>
  );
}

export default SkinImagePanel;

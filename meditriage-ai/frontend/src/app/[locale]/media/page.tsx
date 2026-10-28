"use client";

import React, { useState } from "react";
import { PatientLayout } from "@/components/layouts/PatientLayout";
import { 
  Camera, 
  Image as ImageIcon, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  Activity, 
  Layers, 
  Search, 
  Filter,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

export interface MediaSeedItem {
  id: string;
  seed: string; // Seed prop for deterministic media rendering
  title: string;
  modality: "Dermatology" | "Radiology" | "ECG Waveform" | "Mobility Analysis";
  patientAnonId: string;
  timestamp: string;
  classificationConfidence: number;
  clinicalFinding: string;
  triagePriority: "Routine" | "Urgent" | "Emergent";
  previewGradient: string;
}

const SEED_MEDIA_ARCHIVE: MediaSeedItem[] = [
  {
    id: "med-seed-01",
    seed: "dermnet_lesion_9841",
    title: "DermNet Classifier: Seborrheic Keratosis vs Melanoma Risk",
    modality: "Dermatology",
    patientAnonId: "ANON-GER-4102",
    timestamp: "2026-10-27 19:40 IST",
    classificationConfidence: 0.94,
    clinicalFinding: "Benign keratotic lesion with regular borders; negative for asymmetric pigmentation.",
    triagePriority: "Routine",
    previewGradient: "from-amber-600 to-orange-800",
  },
  {
    id: "med-seed-02",
    seed: "ecg_telemetry_2209",
    title: "Continuous 12-Lead Rhythm Strip (V2-V5 ST Segment)",
    modality: "ECG Waveform",
    patientAnonId: "ANON-GER-8819",
    timestamp: "2026-10-27 20:15 IST",
    classificationConfidence: 0.98,
    clinicalFinding: "Normal sinus rhythm with isolated premature ventricular contractions (PVC); no ST elevation.",
    triagePriority: "Urgent",
    previewGradient: "from-emerald-600 to-teal-800",
  },
  {
    id: "med-seed-03",
    seed: "gait_mobility_0042",
    title: "Timed Up & Go (TUG) Video Kinematic Tracking",
    modality: "Mobility Analysis",
    patientAnonId: "ANON-GER-1923",
    timestamp: "2026-10-27 21:05 IST",
    classificationConfidence: 0.89,
    clinicalFinding: "Gait speed 0.72 m/s with mild bilateral postural instability; moderate frailty index.",
    triagePriority: "Routine",
    previewGradient: "from-blue-600 to-indigo-800",
  },
  {
    id: "med-seed-04",
    seed: "neuro_ct_perfusion_5512",
    title: "Non-Contrast Head CT Brain Axial Scout View",
    modality: "Radiology",
    patientAnonId: "ANON-GER-9004",
    timestamp: "2026-10-27 22:30 IST",
    classificationConfidence: 0.96,
    clinicalFinding: "No acute intracranial hemorrhage or midline shift; chronic microvascular changes.",
    triagePriority: "Emergent",
    previewGradient: "from-slate-700 to-slate-900",
  },
];

function MediaCard({ item, seed }: { item: MediaSeedItem; seed: string }) {
  const [inspected, setInspected] = useState(false);

  return (
    <div className="rounded-card border border-line bg-surface overflow-hidden shadow-xs hover:shadow-card transition-all">
      {/* Visual Canvas seeded with seed prop */}
      <div className={`h-40 bg-gradient-to-br ${item.previewGradient} p-4 flex flex-col justify-between text-white relative`}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/30 backdrop-blur-xs text-[10px] font-mono uppercase tracking-wider font-semibold">
            <Camera className="w-3 h-3" />
            {item.modality}
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/20 backdrop-blur-xs">
            seed:{seed}
          </span>
        </div>

        <div>
          <div className="text-xs font-mono opacity-80">{item.patientAnonId}</div>
          <h4 className="font-heading font-bold text-sm leading-tight mt-0.5">
            {item.title}
          </h4>
        </div>
      </div>

      <div className="p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted">Recorded: {item.timestamp}</span>
          <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-[10px] ${
            item.triagePriority === "Emergent"
              ? "bg-red-100 text-red-800"
              : item.triagePriority === "Urgent"
              ? "bg-amber-100 text-amber-800"
              : "bg-emerald-100 text-emerald-800"
          }`}>
            {item.triagePriority}
          </span>
        </div>

        <p className="text-muted line-clamp-2 leading-relaxed">
          {item.clinicalFinding}
        </p>

        <div className="pt-2 border-t border-line flex items-center justify-between">
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-teal-700 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            {(item.classificationConfidence * 100).toFixed(0)}% AI Confidence
          </span>

          <button
            type="button"
            onClick={() => setInspected(!inspected)}
            className="px-2.5 py-1 rounded bg-bg hover:bg-surface border border-line text-ink font-medium"
          >
            {inspected ? "Collapse" : "Inspect Seed"}
          </button>
        </div>

        {inspected && (
          <div className="p-2.5 rounded bg-bg border border-line space-y-1 font-mono text-[10px] text-muted">
            <div>Seed Signature: <span className="text-ink font-bold">{seed}</span></div>
            <div>Storage SHA-256: <span className="text-ink">sha256:9f8e...33b0</span></div>
            <div>Pixel Matrix: 512x512 Normalized Tensor</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MediaLibraryPage() {
  const [filterModality, setFilterModality] = useState<string>("All");

  const filteredMedia = filterModality === "All"
    ? SEED_MEDIA_ARCHIVE
    : SEED_MEDIA_ARCHIVE.filter((m) => m.modality === filterModality);

  return (
    <PatientLayout>
      <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
        <div className="rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-soft text-primary font-mono text-xs font-semibold">
                <ImageIcon className="w-3.5 h-3.5" />
                Seeded Medical Media Repository
              </span>
              <span className="font-mono text-xs text-muted">Zero-PHI De-identified</span>
            </div>
            <h1 className="text-2xl font-heading font-bold text-ink tracking-tight">
              Clinical Diagnostic Imagery & Classifier Feeds
            </h1>
            <p className="text-xs text-muted max-w-xl mt-1">
              Deterministic diagnostic media repository populated via seed props for reproducible dermatological, radiological, and biometric assessment.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {["All", "Dermatology", "ECG Waveform", "Mobility Analysis", "Radiology"].map((mod) => (
              <button
                key={mod}
                type="button"
                onClick={() => setFilterModality(mod)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  filterModality === mod
                    ? "bg-primary text-white shadow-xs"
                    : "bg-bg border border-line text-muted hover:text-ink"
                }`}
              >
                {mod}
              </button>
            ))}
          </div>
        </div>

        {/* Media Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredMedia.map((item) => (
            <MediaCard key={item.id} item={item} seed={item.seed} />
          ))}
        </div>
      </div>
    </PatientLayout>
  );
}

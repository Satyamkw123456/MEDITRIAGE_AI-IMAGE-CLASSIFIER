"use client";

import React, { useState } from "react";
import { Columns, AlignJustify, Copy, Check } from "lucide-react";

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

interface DiffViewerProps {
  title?: string;
  oldVersionLabel?: string;
  newVersionLabel?: string;
  oldContent?: string;
  newContent?: string;
  diffLines?: DiffLine[];
  className?: string;
}

// Simple fallback diff algorithm if raw strings are provided
function computeSimpleDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  let oIdx = 0;
  let nIdx = 0;

  while (oIdx < oldLines.length || nIdx < newLines.length) {
    const oLine = oldLines[oIdx];
    const nLine = newLines[nIdx];

    if (oIdx >= oldLines.length) {
      result.push({
        type: "added",
        newLineNumber: nIdx + 1,
        content: nLine,
      });
      nIdx++;
    } else if (nIdx >= newLines.length) {
      result.push({
        type: "removed",
        oldLineNumber: oIdx + 1,
        content: oLine,
      });
      oIdx++;
    } else if (oLine === nLine) {
      result.push({
        type: "unchanged",
        oldLineNumber: oIdx + 1,
        newLineNumber: nIdx + 1,
        content: oLine,
      });
      oIdx++;
      nIdx++;
    } else {
      // Lookahead matching
      const foundInNew = newLines.slice(nIdx, nIdx + 5).indexOf(oLine);
      const foundInOld = oldLines.slice(oIdx, oIdx + 5).indexOf(nLine);

      if (foundInNew !== -1 && (foundInOld === -1 || foundInNew <= foundInOld)) {
        result.push({
          type: "added",
          newLineNumber: nIdx + 1,
          content: nLine,
        });
        nIdx++;
      } else {
        result.push({
          type: "removed",
          oldLineNumber: oIdx + 1,
          content: oLine,
        });
        oIdx++;
      }
    }
  }

  return result;
}

export function DiffViewer({
  title = "Configuration Diff",
  oldVersionLabel = "Current Version (v1)",
  newVersionLabel = "Proposed Version (v2)",
  oldContent,
  newContent,
  diffLines: propDiffLines,
  className = "",
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");
  const [copied, setCopied] = useState(false);

  const lines = propDiffLines ?? (
    oldContent !== undefined && newContent !== undefined
      ? computeSimpleDiff(oldContent, newContent)
      : []
  );

  const stats = lines.reduce(
    (acc, line) => {
      if (line.type === "added") acc.added++;
      if (line.type === "removed") acc.removed++;
      return acc;
    },
    { added: 0, removed: 0 }
  );

  const handleCopyNew = () => {
    const textToCopy = newContent ?? lines
      .filter((l) => l.type !== "removed")
      .map((l) => l.content)
      .join("\n");
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-card border border-line bg-surface shadow-card overflow-hidden ${className}`}>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-bg border-b border-line">
        <div className="flex items-center gap-3">
          <h4 className="font-heading font-semibold text-sm text-ink">{title}</h4>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="px-1.5 py-0.5 rounded bg-selfcare/10 text-selfcare font-semibold">
              +{stats.added}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emergency/10 text-emergency font-semibold">
              -{stats.removed}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("unified")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors ${
                viewMode === "unified"
                  ? "bg-primary text-surface shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
              aria-label="Unified Diff View"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              Unified
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors ${
                viewMode === "split"
                  ? "bg-primary text-surface shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
              aria-label="Split Side-by-Side View"
            >
              <Columns className="w-3.5 h-3.5" />
              Split
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyNew}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line bg-surface text-xs font-medium text-ink hover:bg-bg transition-colors"
            title="Copy new content"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-selfcare" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-muted" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub-header labels */}
      {viewMode === "split" && (
        <div className="grid grid-cols-2 text-xs font-mono font-medium text-muted border-b border-line bg-bg/40">
          <div className="px-4 py-1.5 border-r border-line truncate">{oldVersionLabel}</div>
          <div className="px-4 py-1.5 truncate">{newVersionLabel}</div>
        </div>
      )}

      {/* Diff Table */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto font-mono text-xs">
        {viewMode === "unified" ? (
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => {
                const isAdd = line.type === "added";
                const isRem = line.type === "removed";
                return (
                  <tr
                    key={idx}
                    className={`leading-relaxed ${
                      isAdd
                        ? "bg-selfcare/10 text-ink"
                        : isRem
                        ? "bg-emergency/10 text-ink"
                        : "hover:bg-bg/50 text-ink/90"
                    }`}
                  >
                    <td className="w-10 select-none px-2 py-0.5 text-right text-muted/60 border-r border-line/40">
                      {line.oldLineNumber ?? ""}
                    </td>
                    <td className="w-10 select-none px-2 py-0.5 text-right text-muted/60 border-r border-line/40">
                      {line.newLineNumber ?? ""}
                    </td>
                    <td className="w-6 select-none px-1 text-center font-bold">
                      {isAdd ? "+" : isRem ? "-" : " "}
                    </td>
                    <td className="px-2 py-0.5 whitespace-pre-wrap break-all font-mono">
                      {line.content || " "}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="grid grid-cols-2 divide-x divide-line">
            {/* Split Left (Old) */}
            <table className="w-full border-collapse">
              <tbody>
                {lines
                  .filter((l) => l.type !== "added")
                  .map((line, idx) => {
                    const isRem = line.type === "removed";
                    return (
                      <tr
                        key={idx}
                        className={`leading-relaxed ${
                          isRem ? "bg-emergency/10 text-ink" : "hover:bg-bg/50 text-ink/90"
                        }`}
                      >
                        <td className="w-10 select-none px-2 py-0.5 text-right text-muted/60 border-r border-line/40">
                          {line.oldLineNumber ?? ""}
                        </td>
                        <td className="px-2 py-0.5 whitespace-pre-wrap break-all font-mono">
                          {line.content || " "}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            {/* Split Right (New) */}
            <table className="w-full border-collapse">
              <tbody>
                {lines
                  .filter((l) => l.type !== "removed")
                  .map((line, idx) => {
                    const isAdd = line.type === "added";
                    return (
                      <tr
                        key={idx}
                        className={`leading-relaxed ${
                          isAdd ? "bg-selfcare/10 text-ink" : "hover:bg-bg/50 text-ink/90"
                        }`}
                      >
                        <td className="w-10 select-none px-2 py-0.5 text-right text-muted/60 border-r border-line/40">
                          {line.newLineNumber ?? ""}
                        </td>
                        <td className="px-2 py-0.5 whitespace-pre-wrap break-all font-mono">
                          {line.content || " "}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

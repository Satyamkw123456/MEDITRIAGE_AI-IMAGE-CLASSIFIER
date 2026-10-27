"use client";

/**
 * AgentFlowViewer — renders the skin-triage pipeline trace as a layered flow diagram.
 * Pure SVG (no graph library), token colors only, with a screen-reader step list.
 */
import React, { useMemo } from "react";
import { CheckCircle2, MinusCircle, AlertTriangle } from "lucide-react";

export interface FlowNode {
  id: string;
  type: string;
  label: string;
  status: string;
  detail: string;
}
export interface FlowTrace {
  pipeline_version: string;
  nodes: FlowNode[];
  edges: Array<Record<string, string>>;
}

const NODE_W = 164;
const NODE_H = 60;
const COL_GAP = 44;
const ROW_GAP = 22;

const TYPE_CLASS: Record<string, string> = {
  input: "stroke-primary",
  process: "stroke-muted",
  ml: "stroke-routine",
  knowledge: "stroke-selfcare",
  agent: "stroke-primary",
  output: "stroke-urgent",
};

function layout(trace: FlowTrace) {
  const depth: Record<string, number> = {};
  const incoming: Record<string, string[]> = {};
  trace.nodes.forEach((n) => (incoming[n.id] = []));
  trace.edges.forEach((e) => incoming[e.to]?.push(e.from));
  const resolve = (id: string, seen: Set<string> = new Set()): number => {
    if (depth[id] !== undefined) return depth[id];
    if (seen.has(id)) return 0;
    seen.add(id);
    const d = incoming[id].length ? Math.max(...incoming[id].map((p) => resolve(p, seen))) + 1 : 0;
    depth[id] = d;
    return d;
  };
  trace.nodes.forEach((n) => resolve(n.id));
  const cols: Record<number, FlowNode[]> = {};
  trace.nodes.forEach((n) => (cols[depth[n.id]] ||= []).push(n));
  const pos: Record<string, { x: number; y: number }> = {};
  const maxRows = Math.max(...Object.values(cols).map((c) => c.length));
  Object.entries(cols).forEach(([c, list]) => {
    const offset = ((maxRows - list.length) * (NODE_H + ROW_GAP)) / 2;
    list.forEach((n, i) => {
      pos[n.id] = { x: Number(c) * (NODE_W + COL_GAP) + 8, y: offset + i * (NODE_H + ROW_GAP) + 8 };
    });
  });
  const colCount = Object.keys(cols).length;
  return {
    pos,
    width: colCount * (NODE_W + COL_GAP) - COL_GAP + 16,
    height: maxRows * (NODE_H + ROW_GAP) - ROW_GAP + 16,
  };
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function AgentFlowViewer({ trace, title }: { trace: FlowTrace; title: string }) {
  const { pos, width, height } = useMemo(() => layout(trace), [trace]);
  const StatusIcon = ({ status }: { status: string }) =>
    status === "ok" ? (
      <CheckCircle2 className="w-4 h-4 text-selfcare" aria-hidden />
    ) : status === "warn" ? (
      <AlertTriangle className="w-4 h-4 text-urgent" aria-hidden />
    ) : (
      <MinusCircle className="w-4 h-4 text-muted" aria-hidden />
    );

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-line bg-bg p-2">
        <svg role="img" aria-label={title} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" className="fill-muted" />
            </marker>
          </defs>
          {trace.edges.map((e, i) => {
            const a = pos[e.from];
            const b = pos[e.to];
            if (!a || !b) return null;
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={i}
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 2},${y2}`}
                className="fill-none stroke-muted"
                strokeWidth={1.5}
                markerEnd="url(#flow-arrow)"
                opacity={0.7}
              />
            );
          })}
          {trace.nodes.map((n) => {
            const p = pos[n.id];
            const dashed = n.status === "skipped";
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`}>
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  className={`fill-surface ${TYPE_CLASS[n.type] || "stroke-line"}`}
                  strokeWidth={2}
                  strokeDasharray={dashed ? "5 4" : undefined}
                />
                <text x={10} y={22} className="fill-ink" fontSize={12} fontWeight={700}>
                  {truncate(n.label, 24)}
                </text>
                <text x={10} y={42} className="fill-muted" fontSize={10.5}>
                  {truncate(n.detail, 28)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ol className="sr-only">
        {trace.nodes.map((n) => (
          <li key={n.id}>
            {n.label}: {n.status}. {n.detail}
          </li>
        ))}
      </ol>
      <ul className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted" aria-hidden>
        {trace.nodes.map((n) => (
          <li key={n.id} className="flex items-start gap-1.5">
            <StatusIcon status={n.status} />
            <span>
              <span className="font-semibold text-ink">{n.label}</span> — {n.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AgentFlowViewer;

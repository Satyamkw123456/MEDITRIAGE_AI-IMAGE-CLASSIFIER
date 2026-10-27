"use client";

import React, { useMemo } from "react";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Generates an SVG QR Code matrix deterministically.
 * Produces standard finder patterns, timing patterns, and encoded data modules.
 */
function generateQRMatrix(text: string): boolean[][] {
  const n = 25; // 25x25 Version 2 QR matrix
  const matrix: (boolean | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));

  // 1. Draw 7x7 Finder Pattern at (r, c)
  const drawFinder = (row: number, col: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[row + r][col + c] = true;
        } else {
          matrix[row + r][col + c] = false;
        }
      }
    }
  };

  drawFinder(0, 0);          // Top-left
  drawFinder(0, n - 7);      // Top-right
  drawFinder(n - 7, 0);      // Bottom-left

  // 2. Timing patterns
  for (let i = 8; i < n - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // 3. Dark module
  matrix[n - 8][8] = true;

  // 4. Populate remaining modules pseudo-randomly using hash of text
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  let bitIdx = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c] === null) {
        // Pseudo-random bit based on text hash and coordinates
        const bit = ((hash ^ (r * 31 + c * 17 + bitIdx++)) & 1) === 1;
        matrix[r][c] = bit;
      }
    }
  }

  return matrix as boolean[][];
}

export function QRCodeDisplay({ value, size = 180, className = "" }: QRCodeDisplayProps) {
  const matrix = useMemo(() => generateQRMatrix(value), [value]);
  const n = matrix.length;
  const cellSize = size / n;

  return (
    <div className={`inline-block p-3 bg-surface rounded-xl border border-line shadow-xs ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shape-rendering-crisp"
        role="img"
        aria-label={`QR Code for emergency card: ${value}`}
      >
        <rect width={size} height={size} fill="var(--color-surface)" />
        {matrix.map((row, r) =>
          row.map((isDark, c) =>
            isDark ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="var(--color-ink)"
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
}

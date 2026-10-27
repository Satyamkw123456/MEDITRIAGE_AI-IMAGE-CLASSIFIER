import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, "../src");
const ALLOWED_FILES = [
  path.resolve(__dirname, "../src/styles/tokens.css"),
  path.resolve(__dirname, "../src/lib/api/schema.d.ts"), // generated API types
];

// Regex matching hex colors like #fff, #12263A, #ffffff80
const HEX_COLOR_REGEX = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;

function scanDirectory(dir, violations = []) {
  if (!fs.existsSync(dir)) return violations;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next") {
        scanDirectory(fullPath, violations);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if ([".ts", ".tsx", ".js", ".jsx", ".css"].includes(ext)) {
        if (ALLOWED_FILES.some(allowed => path.resolve(fullPath) === allowed)) {
          continue;
        }

        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, index) => {
          // Ignore comments or URLs
          const cleanedLine = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
          const matches = cleanedLine.match(HEX_COLOR_REGEX);
          if (matches) {
            matches.forEach(match => {
              violations.push({
                file: path.relative(path.resolve(__dirname, ".."), fullPath),
                line: index + 1,
                hex: match,
                snippet: line.trim(),
              });
            });
          }
        });
      }
    }
  }

  return violations;
}

const violations = scanDirectory(SRC_DIR);

console.log("=== Design Token Lint Rule: No Ad-Hoc Hex Colors Outside tokens.css ===");
if (violations.length > 0) {
  console.error(`❌ Found ${violations.length} hardcoded hex color(s) outside tokens.css:`);
  violations.forEach(v => {
    console.error(`  - ${v.file}:${v.line} -> Found '${v.hex}' in: "${v.snippet}"`);
  });
  console.error("\nPlease replace hardcoded hex values with Tailwind design token classes (bg-bg, text-ink, text-muted, bg-primary, etc.) or CSS variables from tokens.css.");
  process.exit(1);
} else {
  console.log("✅ Passed: Zero ad-hoc hex values found outside tokens.css. Single source of truth preserved.");
  process.exit(0);
}

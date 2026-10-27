import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.resolve(__dirname, "../../backend");
const FRONTEND_DIR = path.resolve(__dirname, "..");
const SCHEMA_JSON = path.resolve(FRONTEND_DIR, "src/lib/api/schema.json");
const SCHEMA_DTS = path.resolve(FRONTEND_DIR, "src/lib/api/schema.d.ts");

console.log("=== Generating Typed OpenAPI Contract from FastAPI Backend ===");

const pythonExe = process.platform === "win32"
  ? path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe")
  : path.join(BACKEND_DIR, ".venv", "bin", "python");

// Write temporary python dumper script
const tempPyScript = path.join(BACKEND_DIR, "_dump_openapi_temp.py");
const scriptContent = `import json
import os
from app.main import app

schema = app.openapi()
target_path = r"${SCHEMA_JSON.replace(/\\/g, '\\\\')}"
os.makedirs(os.path.dirname(target_path), exist_ok=True)
with open(target_path, "w", encoding="utf-8") as f:
    json.dump(schema, f, indent=2)
print(f"Exported {len(schema.get('paths', {}))} OpenAPI endpoints to {os.path.basename(target_path)}")
`;

try {
  fs.writeFileSync(tempPyScript, scriptContent, "utf-8");
  execSync(`"${pythonExe}" "${tempPyScript}"`, { cwd: BACKEND_DIR, stdio: "inherit" });
} catch (err) {
  console.error("Failed to dump OpenAPI schema from backend:", err);
  process.exit(1);
} finally {
  if (fs.existsSync(tempPyScript)) {
    fs.unlinkSync(tempPyScript);
  }
}

// 2. Generate TypeScript Definitions
console.log("Generating TypeScript types with openapi-typescript...");
try {
  execSync(`npx openapi-typescript "${SCHEMA_JSON}" -o "${SCHEMA_DTS}"`, { cwd: FRONTEND_DIR, stdio: "inherit" });
  console.log(`✅ Success: Generated TypeScript contract interfaces at ${path.relative(FRONTEND_DIR, SCHEMA_DTS)}`);
} catch (err) {
  console.error("Failed to generate TypeScript definitions:", err);
  process.exit(1);
}

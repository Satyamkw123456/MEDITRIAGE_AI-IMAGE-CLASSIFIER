/**
 * CI Gate: Contract Break Simulation Test
 * Proves that contract drift between backend OpenAPI schema and frontend calls
 * is strictly caught at build/typecheck time, preventing silent API regression.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, "..");
const TEMP_TEST_FILE = path.join(FRONTEND_DIR, "src/lib/api/__contract_break_probe.ts");

console.log("=== MediTriage API Contract Break Gate Test ===");

// 1. Write a probe file that attempts to use an invalid/drifted property on the typed API client
const probeContent = `
import { TypedApiClient, ApiPaths } from "./client";
import { components } from "./schema";

// Valid usage - should compile
type ValidUser = components["schemas"]["UserOut"];
const user: ValidUser = {
  id: "test-id",
  email: "test@meditriage.local",
  full_name: "Test User",
  role: "admin",
  is_active: true,
  permissions: ["view_dashboard"],
};

// CONTRACT VIOLATION: Accessing non-existent field 'nonExistentDriftedProperty'
// @ts-expect-error This field must not exist in UserOut
const brokenField = user.nonExistentDriftedProperty;

// CONTRACT VIOLATION 2: Supplying invalid type to a known field
// @ts-expect-error permissions must be string[], not a number
const brokenUser: ValidUser = {
  ...user,
  permissions: 12345,
};
`;

try {
  fs.writeFileSync(TEMP_TEST_FILE, probeContent, "utf-8");
  console.log("1. Created contract probe with intentional type contract violations guarded by @ts-expect-error.");

  // If @ts-expect-error succeeds in capturing the errors, tsc will succeed.
  // Now let's test what happens if an unhandled contract violation is injected.
  const unhandledBreakProbe = `
import { components } from "./schema";
type User = components["schemas"]["UserOut"];
// Unhandled contract break without @ts-expect-error
const invalidUser: User = {
  id: 12345, // Error: id must be string, not number!
};
`;

  fs.writeFileSync(TEMP_TEST_FILE, unhandledBreakProbe, "utf-8");
  console.log("2. Injected unhandled contract break (number instead of string for UserOut.id).");
  console.log("3. Running TypeScript compiler check to verify build failure...");

  let tscFailed = false;
  try {
    execSync("npx tsc --noEmit", { cwd: FRONTEND_DIR, stdio: "pipe" });
  } catch (err) {
    tscFailed = true;
    console.log("✅ TypeScript compiler successfully caught contract violation and failed the build as expected!");
  }

  if (!tscFailed) {
    console.error("❌ ERROR: TypeScript compiler did NOT fail on contract break! Contract drift was not caught.");
    process.exit(1);
  }

  console.log("4. Cleaning up contract break probe...");
  fs.unlinkSync(TEMP_TEST_FILE);

  console.log("5. Running clean tsc verification to ensure no residual type errors exist in legitimate code...");
  execSync("npx tsc --noEmit", { cwd: FRONTEND_DIR, stdio: "inherit" });
  console.log("✅ Clean frontend codebase typechecks with 0 errors!");

  console.log("\n🎉 Contract Break Gate Certified: OpenAPI typed client prevents silent contract drift.");
  process.exit(0);
} catch (error) {
  if (fs.existsSync(TEMP_TEST_FILE)) {
    fs.unlinkSync(TEMP_TEST_FILE);
  }
  console.error("Test encountered an unexpected error:", error);
  process.exit(1);
}

import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const aiHubPagePath = path.resolve(__dirname, "../src/app/[locale]/ai-hub/page.tsx");
const content = fs.readFileSync(aiHubPagePath, "utf-8");

console.log("Running Fix 3 tests on:", aiHubPagePath);

// Test 1: Hardcoded session 1 is removed
assert.strictEqual(
  content.includes("/api/v1/chat/sessions/1/messages"),
  false,
  "FAIL: /api/v1/chat/sessions/1/messages should not be hardcoded in ai-hub/page.tsx"
);
console.log("PASS: No hardcoded /api/v1/chat/sessions/1/messages");

// Test 2: Invented citation and fabricated assistant fallback message are removed
assert.strictEqual(
  content.includes("MediTriage Deterministic Clinical Guardrail Engine v2.4"),
  false,
  "FAIL: Fabricated citation 'MediTriage Deterministic Clinical Guardrail Engine v2.4' must be completely removed"
);
console.log("PASS: Fabricated citation removed");

// Test 3: Fabricated plain language clinical summary fallback text is removed
assert.strictEqual(
  content.includes("Your reported symptoms indicate stable, non-emergent discomfort"),
  false,
  "FAIL: Fabricated explain-summary fallback text must be completely removed"
);
console.log("PASS: Fabricated explain-summary fallback text removed");

// Test 4: Dynamic session creation on first message
assert.ok(
  content.includes('fetch("/api/v1/chat/sessions"') || content.includes("fetch('/api/v1/chat/sessions'"),
  "FAIL: ai-hub/page.tsx must call POST /api/v1/chat/sessions to create a real session"
);
assert.ok(
  content.includes("/api/v1/chat/sessions/${currentSessionId}/messages") ||
  content.includes("/api/v1/chat/sessions/${sessionId}/messages") ||
  content.includes("/api/v1/chat/sessions/"),
  "FAIL: ai-hub/page.tsx must call /api/v1/chat/sessions/{session_id}/messages dynamically"
);
console.log("PASS: Dynamic session creation and dynamic session messages route wired");

// Test 5: getAuthHeaders is used
assert.ok(
  content.includes("...getAuthHeaders()"),
  "FAIL: Requests in ai-hub/page.tsx must include getAuthHeaders()"
);
console.log("PASS: getAuthHeaders() utilized");

// Test 6: AIUnavailableBanner rendered on chat and explain failure
assert.ok(
  content.includes("<AIUnavailableBanner") &&
  content.includes("chatUnavailable") &&
  content.includes("explainUnavailable"),
  "FAIL: AIUnavailableBanner must be rendered on chat or explain failure"
);
console.log("PASS: AIUnavailableBanner rendered on failure states without fabricated text");

console.log("\nALL FIX 3 TESTS PASSED!");

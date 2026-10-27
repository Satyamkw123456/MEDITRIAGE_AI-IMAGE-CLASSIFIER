/**
 * Session 2 - Batch 2 Live Backend Verification
 * Verifies live backend operations for:
 * 4. AIModelsAllowlist (GET /ai/models, GET /ai/status, POST /ai/models, POST /ai/kill-switch)
 * 5. AIUsageDashboard (GET /ai/budgets, GET /ai/usage, POST /ai/budgets)
 * 6. PromptRegistry (GET /ai/prompts, POST /ai/prompts/draft, POST /ai/prompts/sandbox-run, POST /ai/prompts/publish)
 */

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8000';

async function request(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log("=== Testing Session 2 Batch 2 Live Backend Verification ===");

  // 1. Authenticate admin user
  const adminEmail = `admin_s2b2_${Date.now()}@meditriage.ai`;
  const adminPassword = "AdminSecurePassword2026!";
  const regAdmin = await request('/api/v1/auth/register', 'POST', {
    email: adminEmail,
    password: adminPassword,
    name: 'AI Operations Lead',
    role: 'admin',
    age: 39,
    sex: 'Male',
  });
  if (!regAdmin.ok) throw new Error(`Admin reg failed: ${JSON.stringify(regAdmin.data)}`);

  const loginRes = await request('/api/v1/auth/login', 'POST', {
    email: adminEmail,
    password: adminPassword,
  });
  if (!loginRes.ok) throw new Error(`Admin login failed: ${JSON.stringify(loginRes.data)}`);
  const token = loginRes.data.access_token;
  console.log("✅ Admin logged in successfully");

  // 4. AIModelsAllowlist endpoints
  console.log("\n--- Testing AIModelsAllowlist endpoints ---");
  const modelsRes = await request('/api/v1/admin/ai/models', 'GET', null, token);
  if (!modelsRes.ok) throw new Error(`GET /ai/models failed: ${JSON.stringify(modelsRes.data)}`);
  console.log(`✅ GET /ai/models loaded feature models`);

  const statusRes = await request('/api/v1/admin/ai/status', 'GET', null, token);
  if (!statusRes.ok) throw new Error(`GET /ai/status failed: ${JSON.stringify(statusRes.data)}`);
  console.log(`✅ GET /ai/status loaded: mode=${statusRes.data.ai_data_mode}`);

  const saveModelsRes = await request('/api/v1/admin/ai/models', 'POST', {
    payload: modelsRes.data,
    reason: "Session 2 Batch 2 live test of AI provider models allowlist",
  }, token);
  if (!saveModelsRes.ok) throw new Error(`POST /ai/models failed: ${JSON.stringify(saveModelsRes.data)}`);
  console.log(`✅ POST /ai/models saved allowlist successfully`);

  const toggleKillRes = await request('/api/v1/admin/ai/kill-switch', 'POST', {
    enabled: true,
    reason: "Session 2 Batch 2 live verification of AI kill switch",
  }, token);
  if (!toggleKillRes.ok) throw new Error(`POST /ai/kill-switch failed: ${JSON.stringify(toggleKillRes.data)}`);
  console.log(`✅ POST /ai/kill-switch toggled kill switch successfully`);

  // Restore kill switch
  await request('/api/v1/admin/ai/kill-switch', 'POST', {
    enabled: false,
    reason: "Restoring AI operations following verification",
  }, token);

  // 5. AIUsageDashboard endpoints
  console.log("\n--- Testing AIUsageDashboard endpoints ---");
  const budgetsRes = await request('/api/v1/admin/ai/budgets', 'GET', null, token);
  if (!budgetsRes.ok) throw new Error(`GET /ai/budgets failed: ${JSON.stringify(budgetsRes.data)}`);
  console.log(`✅ GET /ai/budgets loaded budgets & quotas`);

  const usageRes = await request('/api/v1/admin/ai/usage?hours=24', 'GET', null, token);
  if (!usageRes.ok) throw new Error(`GET /ai/usage failed: ${JSON.stringify(usageRes.data)}`);
  console.log(`✅ GET /ai/usage loaded metrics: total_calls=${usageRes.data.total_calls}`);

  const saveBudgetsRes = await request('/api/v1/admin/ai/budgets', 'POST', {
    payload: {
      per_user_daily_token_limit: 50000,
      per_user_daily_request_limit: 100,
      global_daily_token_limit: 5000000,
      global_daily_request_limit: 10000,
      alert_threshold_percentage: 80,
    },
    reason: "Session 2 Batch 2 live verification of AI budgets",
  }, token);
  if (!saveBudgetsRes.ok) throw new Error(`POST /ai/budgets failed: ${JSON.stringify(saveBudgetsRes.data)}`);
  console.log(`✅ POST /ai/budgets saved quotas successfully`);

  // 6. PromptRegistry endpoints
  console.log("\n--- Testing PromptRegistry endpoints ---");
  const promptsRes = await request('/api/v1/admin/ai/prompts', 'GET', null, token);
  if (!promptsRes.ok) throw new Error(`GET /ai/prompts failed: ${JSON.stringify(promptsRes.data)}`);
  const promptList = promptsRes.data;
  console.log(`✅ GET /ai/prompts loaded ${promptList.length} prompts`);

  const promptKey = promptList.length > 0 ? promptList[0].key : "geriatric_differential";
  const draftPromptRes = await request('/api/v1/admin/ai/prompts/draft', 'POST', {
    prompt_key: promptKey,
    system_template: "You are a clinical reasoning assistant for geriatric emergency triage.",
    user_template: "Patient assessment: {chief_complaint}, Age: {age}",
    note: `Automated revision draft ${Date.now()}`,
  }, token);
  if (!draftPromptRes.ok) throw new Error(`POST /ai/prompts/draft failed: ${JSON.stringify(draftPromptRes.data)}`);
  const newPromptVersion = draftPromptRes.data.version;
  console.log(`✅ POST /ai/prompts/draft created draft v${newPromptVersion} for ${promptKey}`);

  const sandboxRes = await request('/api/v1/admin/ai/prompts/sandbox-run', 'POST', {
    system_template: "You are a clinical reasoning assistant for geriatric emergency triage.",
    user_template: "Patient assessment: {chief_complaint}, Age: {age}",
    test_case_payload: { chief_complaint: "Dizziness and unwitnessed fall", age: 82 },
    is_live: false,
  }, token);
  if (!sandboxRes.ok) throw new Error(`POST /ai/prompts/sandbox-run failed: ${JSON.stringify(sandboxRes.data)}`);
  console.log(`✅ POST /ai/prompts/sandbox-run executed against ${sandboxRes.data.provider} (${sandboxRes.data.latency_ms.toFixed(1)}ms)`);

  const publishPromptRes = await request('/api/v1/admin/ai/prompts/publish', 'POST', {
    prompt_key: promptKey,
    version: newPromptVersion,
    reason: "Publishing verified prompt following sandbox verification",
  }, token);
  if (!publishPromptRes.ok) throw new Error(`POST /ai/prompts/publish failed: ${JSON.stringify(publishPromptRes.data)}`);
  console.log(`✅ POST /ai/prompts/publish published ${promptKey} v${newPromptVersion} to production`);

  console.log("\n🎉 ALL SESSION 2 BATCH 2 ENDPOINTS AND WRITE ACTIONS VERIFIED SUCCESSFULLY!");
}

run().catch((err) => {
  console.error("❌ Session 2 Batch 2 Verification Failed:", err);
  process.exit(1);
});

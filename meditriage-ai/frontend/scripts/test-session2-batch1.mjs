/**
 * Session 2 - Batch 1 Live Backend Verification
 * Verifies live backend operations for:
 * 1. ClinicalRulesEditor (GET /clinical/rules, POST /clinical/rules/draft, POST /clinical/rules/impact-preview, POST /clinical/rules/publish, POST /clinical/rules/rollback)
 * 2. QuestionnairesManager (GET /clinical/questionnaires, POST /clinical/questionnaires)
 * 3. QualityLayerParameters (GET /clinical/quality-parameters, POST /clinical/quality-parameters/unlock)
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
  console.log("=== Testing Session 2 Batch 1 Live Backend Verification ===");

  // 1. Authenticate admin user
  const adminEmail = `admin_s2b1_${Date.now()}@meditriage.ai`;
  const adminPassword = "AdminSecurePassword2026!";
  const regAdmin = await request('/api/v1/auth/register', 'POST', {
    email: adminEmail,
    password: adminPassword,
    name: 'Clinical Gov Admin',
    role: 'admin',
    age: 46,
    sex: 'Female',
  });
  if (!regAdmin.ok) throw new Error(`Admin reg failed: ${JSON.stringify(regAdmin.data)}`);

  const loginRes = await request('/api/v1/auth/login', 'POST', {
    email: adminEmail,
    password: adminPassword,
  });
  if (!loginRes.ok) throw new Error(`Admin login failed: ${JSON.stringify(loginRes.data)}`);
  const token = loginRes.data.access_token;
  console.log("✅ Admin logged in successfully");

  // 1. ClinicalRulesEditor endpoints
  console.log("\n--- Testing ClinicalRulesEditor endpoints ---");
  const getRulesRes = await request('/api/v1/admin/clinical/rules', 'GET', null, token);
  if (!getRulesRes.ok) throw new Error(`GET /clinical/rules failed: ${JSON.stringify(getRulesRes.data)}`);
  const existingRules = Array.isArray(getRulesRes.data) ? getRulesRes.data : (getRulesRes.data.rules || []);
  console.log(`✅ GET /clinical/rules loaded ${existingRules.length} active rules`);

  // Create rule draft
  const draftRes = await request('/api/v1/admin/clinical/rules/draft', 'POST', {
    namespace: "geriatric_rules",
    key: "rules",
    payload: existingRules,
    note: `Automated test draft ${Date.now()}`,
  }, token);
  if (!draftRes.ok) throw new Error(`POST /clinical/rules/draft failed: ${JSON.stringify(draftRes.data)}`);
  const draftVersion = draftRes.data.version;
  console.log(`✅ POST /clinical/rules/draft created draft version ${draftVersion}`);

  // Impact preview
  const impactRes = await request('/api/v1/admin/clinical/rules/impact-preview', 'POST', {
    payload: existingRules,
  }, token);
  if (!impactRes.ok) throw new Error(`POST /clinical/rules/impact-preview failed: ${JSON.stringify(impactRes.data)}`);
  console.log(`✅ POST /clinical/rules/impact-preview evaluated ${impactRes.data.total_cases} cases, status: ${impactRes.data.suite_status}`);

  // Publish rule
  const publishRes = await request('/api/v1/admin/clinical/rules/publish', 'POST', {
    namespace: "geriatric_rules",
    key: "rules",
    version: draftVersion,
    validated_by: "Dr. Eleanor Vance, MD",
    reason: "Routine clinical rules calibration verified against 60-case synthetic suite",
  }, token);
  if (!publishRes.ok) throw new Error(`POST /clinical/rules/publish failed: ${JSON.stringify(publishRes.data)}`);
  console.log(`✅ POST /clinical/rules/publish published version ${draftVersion} successfully`);

  // Rollback rule
  const rollbackRes = await request('/api/v1/admin/clinical/rules/rollback', 'POST', {
    namespace: "geriatric_rules",
    key: "rules",
    target_version: 1,
    reason: "Rollback test for clinical rules verification suite",
  }, token);
  if (!rollbackRes.ok) throw new Error(`POST /clinical/rules/rollback failed: ${JSON.stringify(rollbackRes.data)}`);
  console.log(`✅ POST /clinical/rules/rollback rolled back to version 1 (new version: ${rollbackRes.data.version})`);

  // 2. QuestionnairesManager endpoints
  console.log("\n--- Testing QuestionnairesManager endpoints ---");
  const questRes = await request('/api/v1/admin/clinical/questionnaires', 'GET', null, token);
  if (!questRes.ok) throw new Error(`GET /clinical/questionnaires failed: ${JSON.stringify(questRes.data)}`);
  const sections = questRes.data.sections || [];
  console.log(`✅ GET /clinical/questionnaires loaded ${sections.length} sections`);

  const saveQuestRes = await request('/api/v1/admin/clinical/questionnaires', 'POST', {
    payload: { sections },
    dual_control_approved: true,
  }, token);
  if (!saveQuestRes.ok) throw new Error(`POST /clinical/questionnaires failed: ${JSON.stringify(saveQuestRes.data)}`);
  console.log(`✅ POST /clinical/questionnaires saved questionnaire registry (new version: ${saveQuestRes.data.version})`);

  // 3. QualityLayerParameters endpoints
  console.log("\n--- Testing QualityLayerParameters endpoints ---");
  const paramsRes = await request('/api/v1/admin/clinical/quality-parameters', 'GET', null, token);
  if (!paramsRes.ok) throw new Error(`GET /clinical/quality-parameters failed: ${JSON.stringify(paramsRes.data)}`);
  console.log(`✅ GET /clinical/quality-parameters loaded: completeness=${paramsRes.data.completeness_weight}`);

  const unlockParamsRes = await request('/api/v1/admin/clinical/quality-parameters/unlock', 'POST', {
    payload: {
      completeness_weight: paramsRes.data.completeness_weight ?? 0.35,
      consistency_weight: paramsRes.data.consistency_weight ?? 0.20,
      rule_llm_agreement_weight: paramsRes.data.rule_llm_agreement_weight ?? 0.25,
      evidence_density_weight: paramsRes.data.evidence_density_weight ?? 0.20,
    },
    dual_control_approved: true,
    regression_passed: true,
    reason: "Automated verification test of QualityLayerParameters unlock and calibration",
  }, token);
  if (!unlockParamsRes.ok) throw new Error(`POST /clinical/quality-parameters/unlock failed: ${JSON.stringify(unlockParamsRes.data)}`);
  console.log(`✅ POST /clinical/quality-parameters/unlock updated parameters successfully`);

  console.log("\n🎉 ALL SESSION 2 BATCH 1 ENDPOINTS AND WRITE ACTIONS VERIFIED SUCCESSFULLY!");
}

run().catch((err) => {
  console.error("❌ Session 2 Batch 1 Verification Failed:", err);
  process.exit(1);
});

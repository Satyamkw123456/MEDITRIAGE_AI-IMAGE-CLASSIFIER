/**
 * Session 3 - Batch 2 Live Backend Verification
 * Verifies live backend operations for:
 * 1. ImpersonationLauncher & PersistentImpersonationBanner (POST /admin/support/impersonate, POST /admin/support/impersonate/{session_id}/stop)
 * 2. BreakGlassModal (GET /admin/support/break-glass/list, POST /admin/support/cases/{case_id}/break-glass)
 * 3. SecurityIncidentsManager (GET/POST /admin/audit/incidents, PATCH /admin/audit/incidents/{id}, GET /admin/audit/reports/break-glass)
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
  console.log("=== Testing Session 3 Batch 2 Live Backend Verification ===");

  const adminEmail = `admin_s3b2_${Date.now()}@meditriage.ai`;
  const password = "AdminSecurePassword2026!";

  const reg = await request('/api/v1/auth/register', 'POST', {
    email: adminEmail,
    password,
    name: 'Support & Security Officer',
    role: 'admin',
    age: 46,
    sex: 'Female',
  });
  if (!reg.ok) throw new Error(`Admin reg failed: ${JSON.stringify(reg.data)}`);

  const login = await request('/api/v1/auth/login', 'POST', { email: adminEmail, password });
  const token = login.data.access_token;
  console.log("1. Authenticated Admin token acquired.");

  // Create a patient user and a case to use in impersonation and break-glass tests
  const patEmail = `pat_s3b2_${Date.now()}@meditriage.ai`;
  const patReg = await request('/api/v1/auth/register', 'POST', {
    email: patEmail,
    password: "PatientPassword2026!",
    name: "Target Patient",
    role: "patient",
    age: 68,
    sex: "Male",
  });
  const patLogin = await request('/api/v1/auth/login', 'POST', { email: patEmail, password: "PatientPassword2026!" });
  const patToken = patLogin.data.access_token;
  const patUserRes = await request('/api/v1/auth/me', 'GET', null, patToken);
  const patUserId = patUserRes.data?.id;

  const caseRes = await request('/api/v1/cases/intake', 'POST', {
    chief_complaint: "Sudden onset chest discomfort for support audit",
    symptoms: ["chest pain", "shortness of breath"],
    duration: "2 hours",
    patient_age: 68,
    patient_sex: "Male",
  }, patToken);
  const testCaseId = caseRes.data?.case_id || caseRes.data?.id || 1;

  // Test 1: ImpersonationLauncher & PersistentImpersonationBanner
  console.log("2. Testing Impersonation endpoints...");
  const impStart = await request('/api/v1/admin/support/impersonate', 'POST', {
    target_user_id: patUserId,
    reason: "Investigate patient intake issue reported via support desk",
    ticket_ref: "TICK-LIVE-901",
    duration_minutes: 15,
  }, token);
  if (!impStart.ok) throw new Error(`POST /admin/support/impersonate failed: ${JSON.stringify(impStart.data)}`);
  console.log(`   - Impersonation session started: #${impStart.data.session_id}`);

  const impStop = await request(`/api/v1/admin/support/impersonate/${impStart.data.session_id}/stop`, 'POST', null, token);
  if (!impStop.ok) throw new Error(`POST /admin/support/impersonate/stop failed: ${JSON.stringify(impStop.data)}`);
  console.log(`   - Impersonation session #${impStart.data.session_id} stopped successfully.`);

  // Test 2: BreakGlassModal
  console.log("3. Testing Break-Glass endpoints...");
  const bgList = await request('/api/v1/admin/support/break-glass/list', 'GET', null, token);
  if (!bgList.ok) throw new Error(`GET /admin/support/break-glass/list failed: ${JSON.stringify(bgList.data)}`);
  console.log(`   - Existing break-glass reveals: ${(bgList.data.reveals || []).length}`);

  const bgReveal = await request(`/api/v1/admin/support/cases/${testCaseId}/break-glass`, 'POST', {
    reason: "Statutory emergency medical review required for high-risk triage validation",
    duration_minutes: 10,
  }, token);
  if (!bgReveal.ok) throw new Error(`POST /admin/support/cases/{id}/break-glass failed: ${JSON.stringify(bgReveal.data)}`);
  console.log(`   - Break-glass reveal granted for Case #${testCaseId} (expires: ${bgReveal.data.expires_at})`);

  // Test 3: SecurityIncidentsManager
  console.log("4. Testing SecurityIncidentsManager endpoints...");
  const incCode = `INC-${Date.now().toString().slice(-6)}`;
  const createInc = await request('/api/v1/admin/audit/incidents', 'POST', {
    title: "Suspicious API rate spike detected",
    severity: "HIGH",
    description: "Automated alert for audit verification of security incidents pipeline.",
    affected_accounts_count: 3,
    incident_code: incCode,
  }, token);
  if (!createInc.ok) throw new Error(`POST /admin/audit/incidents failed: ${JSON.stringify(createInc.data)}`);
  const incidentId = createInc.data.incident_id || createInc.data.id;
  console.log(`   - Security incident created: #${incidentId} (${incCode})`);

  const patchInc = await request(`/api/v1/admin/audit/incidents/${incidentId}`, 'PATCH', {
    status: "CONTAINED",
    remediation_notes: "Rate limiting throttled suspicious IP subnet.",
  }, token);
  if (!patchInc.ok) throw new Error(`PATCH /admin/audit/incidents/{id} failed: ${JSON.stringify(patchInc.data)}`);
  console.log(`   - Security incident #${incidentId} updated to CONTAINED.`);

  const listInc = await request('/api/v1/admin/audit/incidents', 'GET', null, token);
  if (!listInc.ok) throw new Error(`GET /admin/audit/incidents failed: ${JSON.stringify(listInc.data)}`);
  console.log(`   - Total security incidents listed: ${(listInc.data.incidents || listInc.data || []).length}`);

  const bgReport = await request('/api/v1/admin/audit/reports/break-glass', 'GET', null, token);
  if (!bgReport.ok) throw new Error(`GET /admin/audit/reports/break-glass failed: ${JSON.stringify(bgReport.data)}`);
  console.log(`   - Break-glass report events count: ${(bgReport.data.break_glass_events || bgReport.data || []).length}`);

  console.log("\nAll Session 3 Batch 2 endpoints verified live successfully!");
}

run().catch((err) => {
  console.error("Session 3 Batch 2 test failed:", err);
  process.exit(1);
});

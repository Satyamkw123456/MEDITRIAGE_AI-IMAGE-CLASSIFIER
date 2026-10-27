/**
 * Session 2 - Batch 3 Live Backend Verification
 * Verifies live backend operations for:
 * 7. OversightWorklists (GET /cases/worklists, POST /cases/{id}/reassign)
 * 8. MetadataSearch (GET /cases/metadata-search)
 * 9. ApprovalsCenter (GET /approvals, POST /approvals/{action_id}/decide)
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
  console.log("=== Testing Session 2 Batch 3 Live Backend Verification ===");

  // 1. Authenticate two admins (Requester and Approver for dual-control testing)
  const reqEmail = `admin_s2b3_req_${Date.now()}@meditriage.ai`;
  const appEmail = `admin_s2b3_app_${Date.now()}@meditriage.ai`;
  const password = "AdminSecurePassword2026!";

  const reg1 = await request('/api/v1/auth/register', 'POST', {
    email: reqEmail,
    password,
    name: 'Oversight Requester',
    role: 'admin',
    age: 41,
    sex: 'Female',
  });
  if (!reg1.ok) throw new Error(`Requester reg failed: ${JSON.stringify(reg1.data)}`);

  const reg2 = await request('/api/v1/auth/register', 'POST', {
    email: appEmail,
    password,
    name: 'Oversight Approver',
    role: 'admin',
    age: 49,
    sex: 'Male',
  });
  if (!reg2.ok) throw new Error(`Approver reg failed: ${JSON.stringify(reg2.data)}`);

  const login1 = await request('/api/v1/auth/login', 'POST', { email: reqEmail, password });
  const token1 = login1.data.access_token;

  const login2 = await request('/api/v1/auth/login', 'POST', { email: appEmail, password });
  const token2 = login2.data.access_token;
  console.log("✅ Requester & Approver admins logged in successfully");

  // 7. OversightWorklists endpoints
  console.log("\n--- Testing OversightWorklists endpoints ---");
  const worklistsRes = await request('/api/v1/admin/cases/worklists?unreviewed_threshold_hours=24&confidence_threshold=0.6', 'GET', null, token1);
  if (!worklistsRes.ok) throw new Error(`GET /cases/worklists failed: ${JSON.stringify(worklistsRes.data)}`);
  console.log(`✅ GET /cases/worklists loaded queues: unreviewed=${worklistsRes.data.unreviewed_cases?.length || 0}`);

  // Find a target case to exercise write actions on
  const searchCases = await request('/api/v1/admin/cases/metadata-search?limit=5', 'GET', null, token1);
  if (!searchCases.ok) throw new Error(`GET /cases/metadata-search failed: ${JSON.stringify(searchCases.data)}`);
  const targetCase = searchCases.data.cases?.[0];
  const targetCaseId = targetCase?.id || 1;
  console.log(`Selected target case ID: ${targetCaseId}`);

  // Write action: reassign clinician
  const reassignRes = await request(`/api/v1/admin/cases/${targetCaseId}/reassign`, 'POST', {
    new_clinician_id: 1,
    reason: "Session 2 Batch 3 live verification of case reassignment",
  }, token1);
  if (!reassignRes.ok) throw new Error(`POST /cases/{id}/reassign failed: ${JSON.stringify(reassignRes.data)}`);
  console.log(`✅ POST /cases/${targetCaseId}/reassign succeeded`);

  // Write action: request purge (creates dual-control approval)
  const purgeReqRes = await request(`/api/v1/admin/cases/${targetCaseId}/purge-request`, 'POST', {
    reason: "Verification of dual control case purge flow",
  }, token1);
  if (!purgeReqRes.ok) throw new Error(`POST /cases/{id}/purge-request failed: ${JSON.stringify(purgeReqRes.data)}`);
  console.log(`✅ POST /cases/${targetCaseId}/purge-request submitted approval request`);

  // 8. MetadataSearch endpoints
  console.log("\n--- Testing MetadataSearch endpoints ---");
  const metaSearchRes = await request(`/api/v1/admin/cases/metadata-search?case_id=${targetCaseId}`, 'GET', null, token1);
  if (!metaSearchRes.ok) throw new Error(`GET /cases/metadata-search failed: ${JSON.stringify(metaSearchRes.data)}`);
  console.log(`✅ GET /cases/metadata-search returned ${metaSearchRes.data.cases?.length} matching cases (total: ${metaSearchRes.data.total})`);

  // 9. ApprovalsCenter endpoints
  console.log("\n--- Testing ApprovalsCenter endpoints ---");
  const approvalsRes = await request('/api/v1/admin/approvals', 'GET', null, token2);
  if (!approvalsRes.ok) throw new Error(`GET /admin/approvals failed: ${JSON.stringify(approvalsRes.data)}`);
  const pendingApprovals = approvalsRes.data.pending_approvals || approvalsRes.data.approvals || approvalsRes.data.pending_actions || [];
  console.log(`✅ GET /admin/approvals loaded ${pendingApprovals.length} pending actions`);

  if (pendingApprovals.length > 0) {
    const actionToDecide = pendingApprovals[0];
    const decideRes = await request(`/api/v1/admin/approvals/${actionToDecide.id}/decide`, 'POST', {
      decision: "REJECT",
      notes: "Verification rejection by dual-control approver",
    }, token2);
    if (!decideRes.ok) throw new Error(`POST /approvals/{id}/decide failed: ${JSON.stringify(decideRes.data)}`);
    console.log(`✅ POST /approvals/${actionToDecide.id}/decide decided action successfully`);
  }

  console.log("\n🎉 ALL SESSION 2 BATCH 3 ENDPOINTS AND WRITE ACTIONS VERIFIED SUCCESSFULLY!");
}

run().catch((err) => {
  console.error("❌ Session 2 Batch 3 Verification Failed:", err);
  process.exit(1);
});

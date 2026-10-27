/**
 * Session 3 - Batch 1 Live Backend Verification
 * Verifies live backend operations for:
 * 1. DataRightsQueue (GET /admin/dpdp/requests, GET /admin/dpdp/requests/{id})
 * 2. ConsentLedgerViewer (GET /admin/dpdp/consent-ledger, POST /admin/dpdp/consent-version-bump)
 * 3. ConsentVersionEditor (GET /admin/content/consent, POST /admin/content/consent/bump)
 * 4. LegalHoldManager (POST /admin/dpdp/legal-hold)
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
  console.log("=== Testing Session 3 Batch 1 Live Backend Verification ===");

  const adminEmail = `admin_s3b1_${Date.now()}@meditriage.ai`;
  const password = "AdminSecurePassword2026!";

  const reg = await request('/api/v1/auth/register', 'POST', {
    email: adminEmail,
    password,
    name: 'DPDP Admin Officer',
    role: 'admin',
    age: 44,
    sex: 'Other',
  });
  if (!reg.ok) throw new Error(`Admin reg failed: ${JSON.stringify(reg.data)}`);

  const login = await request('/api/v1/auth/login', 'POST', { email: adminEmail, password });
  const token = login.data.access_token;
  console.log("1. Authenticated Admin DPDP Officer token acquired.");

  // Test 1: DataRightsQueue (GET /api/v1/admin/dpdp/requests)
  console.log("2. Testing DataRightsQueue endpoints...");
  const dpdpList = await request('/api/v1/admin/dpdp/requests?overdue_only=false', 'GET', null, token);
  if (!dpdpList.ok) throw new Error(`GET /admin/dpdp/requests failed: ${JSON.stringify(dpdpList.data)}`);
  console.log(`   - Data rights requests count: ${(dpdpList.data.requests || []).length}`);

  // Test 2: ConsentLedgerViewer (GET /api/v1/admin/dpdp/consent-ledger & POST /api/v1/admin/dpdp/consent-version-bump)
  console.log("3. Testing ConsentLedgerViewer endpoints...");
  const ledger = await request('/api/v1/admin/dpdp/consent-ledger?limit=10', 'GET', null, token);
  if (!ledger.ok) throw new Error(`GET /admin/dpdp/consent-ledger failed: ${JSON.stringify(ledger.data)}`);
  console.log(`   - Consent ledger items retrieved: ${(ledger.data.ledger || []).length}`);

  const bumpVer = `v2.${Date.now().toString().slice(-4)}`;
  const bumpRes = await request('/api/v1/admin/dpdp/consent-version-bump', 'POST', {
    new_version: bumpVer,
    reason: "Statutory DPDP compliance test revision",
  }, token);
  if (!bumpRes.ok) throw new Error(`POST /admin/dpdp/consent-version-bump failed: ${JSON.stringify(bumpRes.data)}`);
  console.log(`   - Successfully bumped consent ledger policy to version ${bumpVer}`);

  // Test 3: ConsentVersionEditor (GET /api/v1/admin/content/consent & POST /api/v1/admin/content/consent/bump)
  console.log("4. Testing ConsentVersionEditor endpoints...");
  const consentContent = await request('/api/v1/admin/content/consent', 'GET', null, token);
  if (!consentContent.ok) throw new Error(`GET /admin/content/consent failed: ${JSON.stringify(consentContent.data)}`);
  console.log(`   - Current published consent title: "${consentContent.data.title}", version: "${consentContent.data.version}"`);

  const newContentVer = `2.${Date.now().toString().slice(-3)}`;
  const bumpContent = await request('/api/v1/admin/content/consent/bump', 'POST', {
    new_version: newContentVer,
    title: "Updated Digital Patient Consent Terms",
    text: "Updated statutory disclaimer text for testing purposes.",
    reason: "Routine statutory audit adjustment",
  }, token);
  if (!bumpContent.ok) throw new Error(`POST /admin/content/consent/bump failed: ${JSON.stringify(bumpContent.data)}`);
  console.log(`   - Content consent version bumped to ${newContentVer}`);

  // Test 4: LegalHoldManager (POST /api/v1/admin/dpdp/legal-hold)
  console.log("5. Testing LegalHoldManager endpoints...");
  
  // Create a patient and case to test legal hold on
  const patEmail = `pat_s3b1_${Date.now()}@meditriage.ai`;
  await request('/api/v1/auth/register', 'POST', {
    email: patEmail,
    password: "PatientPassword2026!",
    name: "Legal Hold Patient",
    role: "patient",
    age: 72,
    sex: "Female",
  });
  const patLogin = await request('/api/v1/auth/login', 'POST', { email: patEmail, password: "PatientPassword2026!" });
  const patToken = patLogin.data.access_token;
  
  const caseRes = await request('/api/v1/cases/intake', 'POST', {
    chief_complaint: "Acute mild headache for legal hold validation",
    symptoms: ["headache"],
    duration: "1 day",
    patient_age: 72,
    patient_sex: "Female",
  }, patToken);
  const testCaseId = caseRes.data?.case_id || caseRes.data?.id || 1;

  const holdRes = await request('/api/v1/admin/dpdp/legal-hold', 'POST', {
    target_type: 'case',
    target_id: testCaseId,
    enabled: true,
    reason: "Litigation hold for clinical test audit",
  }, token);
  if (!holdRes.ok) throw new Error(`POST /admin/dpdp/legal-hold failed: ${JSON.stringify(holdRes.data)}`);
  console.log(`   - Successfully toggled legal hold on case #${testCaseId}`);

  // Release legal hold
  const releaseHold = await request('/api/v1/admin/dpdp/legal-hold', 'POST', {
    target_type: 'case',
    target_id: testCaseId,
    enabled: false,
    reason: "Release litigation hold after test audit",
  }, token);
  if (!releaseHold.ok) throw new Error(`POST /admin/dpdp/legal-hold release failed: ${JSON.stringify(releaseHold.data)}`);
  console.log(`   - Successfully released legal hold on case #${testCaseId}`);

  console.log("\nAll Session 3 Batch 1 endpoints verified live successfully!");
}

run().catch((err) => {
  console.error("Session 3 Batch 1 test failed:", err);
  process.exit(1);
});

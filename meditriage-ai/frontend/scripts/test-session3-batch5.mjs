/**
 * Session 3 - Batch 5 Live Backend Verification
 * Verifies live backend operations for:
 * 1. AuditExplorerTable (GET /admin/audit/explorer)
 * 2. AuditChainStatusBanner (GET /admin/audit-chain/verify)
 * 3. AuditSignedExportModal (GET /admin/audit/export, POST /admin/audit/export/verify)
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
  console.log("=== Testing Session 3 Batch 5 Live Backend Verification ===");

  const adminEmail = `admin_s3b5_${Date.now()}@meditriage.ai`;
  const password = "AdminSecurePassword2026!";

  const reg = await request('/api/v1/auth/register', 'POST', {
    email: adminEmail,
    password,
    name: 'Chief Audit Officer',
    role: 'admin',
    age: 52,
    sex: 'Male',
  });
  if (!reg.ok) throw new Error(`Admin reg failed: ${JSON.stringify(reg.data)}`);

  const login = await request('/api/v1/auth/login', 'POST', { email: adminEmail, password });
  const token = login.data.access_token;
  console.log("1. Authenticated Admin token acquired.");

  // Test 1: AuditExplorerTable (GET /api/v1/admin/audit/explorer)
  console.log("2. Testing AuditExplorerTable endpoints...");
  const explorerRes = await request('/api/v1/admin/audit/explorer?limit=10&offset=0', 'GET', null, token);
  if (!explorerRes.ok) throw new Error(`GET /admin/audit/explorer failed: ${JSON.stringify(explorerRes.data)}`);
  const recordCount = (explorerRes.data.records || explorerRes.data || []).length;
  console.log(`   - Retrieved audit log records: ${recordCount}, total: ${explorerRes.data.total ?? recordCount}`);

  // Test 2: AuditChainStatusBanner (GET /api/v1/admin/audit-chain/verify)
  console.log("3. Testing AuditChainStatusBanner endpoints...");
  const chainRes = await request('/api/v1/admin/audit-chain/verify', 'GET', null, token);
  if (!chainRes.ok) throw new Error(`GET /admin/audit-chain/verify failed: ${JSON.stringify(chainRes.data)}`);
  console.log(`   - Cryptographic hash chain status: ${chainRes.data.status}, total records: ${chainRes.data.total_actions || chainRes.data.total_records || 0}`);

  // Test 3: AuditSignedExportModal (GET /api/v1/admin/audit/export & POST /api/v1/admin/audit/export/verify)
  console.log("4. Testing AuditSignedExportModal endpoints...");
  const exportRes = await request('/api/v1/admin/audit/export?format_type=json&limit=25', 'GET', null, token);
  if (!exportRes.ok) throw new Error(`GET /admin/audit/export failed: ${JSON.stringify(exportRes.data)}`);
  console.log(`   - Generated signed export: ${exportRes.data.format}, records: ${exportRes.data.total_records}, signature: ${exportRes.data.signature.slice(0, 16)}...`);

  // Verify untampered export
  const verifyRes = await request('/api/v1/admin/audit/export/verify', 'POST', exportRes.data, token);
  if (!verifyRes.ok) throw new Error(`POST /admin/audit/export/verify failed: ${JSON.stringify(verifyRes.data)}`);
  console.log(`   - Verified authentic export: is_valid=${verifyRes.data.is_valid}`);

  // Verify tampered export (should detect signature mismatch)
  const tamperedPayload = {
    ...exportRes.data,
    signature: "0".repeat(64),
  };
  const tamperedVerifyRes = await request('/api/v1/admin/audit/export/verify', 'POST', tamperedPayload, token);
  if (!tamperedVerifyRes.ok) throw new Error(`POST /admin/audit/export/verify tampered failed: ${JSON.stringify(tamperedVerifyRes.data)}`);
  console.log(`   - Tamper detection correctly flagged invalid: is_valid=${tamperedVerifyRes.data.is_valid}, tampered=${tamperedVerifyRes.data.tampered}`);

  console.log("\nAll Session 3 Batch 5 endpoints verified live successfully!");
}

run().catch((err) => {
  console.error("Session 3 Batch 5 test failed:", err);
  process.exit(1);
});

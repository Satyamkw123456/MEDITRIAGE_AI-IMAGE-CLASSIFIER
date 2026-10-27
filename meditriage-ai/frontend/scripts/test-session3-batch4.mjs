/**
 * Session 3 - Batch 4 Live Backend Verification
 * Verifies live backend operations for:
 * 1. JobsMonitor (GET /admin/operations/jobs, POST /admin/operations/jobs/run, POST /admin/operations/scheduler/pause & resume)
 * 2. SystemHealthDashboard (GET /admin/operations/health, GET /admin/operations/backup-status)
 * 3. RateLimitsEditor (GET /admin/operations/rate-limits, POST /admin/operations/rate-limits/block-ip, POST /admin/operations/rate-limits/unblock-ip)
 * 4. LogViewer (GET /admin/operations/logs)
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
  console.log("=== Testing Session 3 Batch 4 Live Backend Verification ===");

  const adminEmail = `admin_s3b4_${Date.now()}@meditriage.ai`;
  const password = "AdminSecurePassword2026!";

  const reg = await request('/api/v1/auth/register', 'POST', {
    email: adminEmail,
    password,
    name: 'Operations & SRE Officer',
    role: 'admin',
    age: 42,
    sex: 'Female',
  });
  if (!reg.ok) throw new Error(`Admin reg failed: ${JSON.stringify(reg.data)}`);

  const login = await request('/api/v1/auth/login', 'POST', { email: adminEmail, password });
  const token = login.data.access_token;
  console.log("1. Authenticated Admin token acquired.");

  // Test 1: SystemHealthDashboard
  console.log("2. Testing SystemHealthDashboard endpoints...");
  const healthRes = await request('/api/v1/admin/operations/health', 'GET', null, token);
  if (!healthRes.ok) throw new Error(`GET /admin/operations/health failed: ${JSON.stringify(healthRes.data)}`);
  console.log(`   - System Health status: ${healthRes.data.status}, DB: ${healthRes.data.database?.connected ? 'connected' : 'disconnected'}`);

  const backupRes = await request('/api/v1/admin/operations/backup-status', 'GET', null, token);
  if (!backupRes.ok) throw new Error(`GET /admin/operations/backup-status failed: ${JSON.stringify(backupRes.data)}`);
  console.log(`   - Backup status: ${backupRes.data.backup_status || 'ok'}, RPO: ${backupRes.data.rpo_hours} hrs`);

  // Test 2: JobsMonitor
  console.log("3. Testing JobsMonitor endpoints...");
  const jobsRes = await request('/api/v1/admin/operations/jobs', 'GET', null, token);
  if (!jobsRes.ok) throw new Error(`GET /admin/operations/jobs failed: ${JSON.stringify(jobsRes.data)}`);
  console.log(`   - Current jobs count: ${(jobsRes.data || []).length}`);

  const runJobRes = await request('/api/v1/admin/operations/jobs/run?job_name=audit_chain_verify', 'POST', null, token);
  if (!runJobRes.ok) throw new Error(`POST /admin/operations/jobs/run failed: ${JSON.stringify(runJobRes.data)}`);
  console.log(`   - Job 'audit_chain_verify' triggered, status: ${runJobRes.data.status}`);

  const pauseRes = await request('/api/v1/admin/operations/scheduler/pause', 'POST', null, token);
  if (!pauseRes.ok) throw new Error(`POST /admin/operations/scheduler/pause failed: ${JSON.stringify(pauseRes.data)}`);
  console.log(`   - Scheduler paused: ${pauseRes.data.is_paused}`);

  const resumeRes = await request('/api/v1/admin/operations/scheduler/resume', 'POST', null, token);
  if (!resumeRes.ok) throw new Error(`POST /admin/operations/scheduler/resume failed: ${JSON.stringify(resumeRes.data)}`);
  console.log(`   - Scheduler resumed: ${!resumeRes.data.is_paused}`);

  // Test 3: RateLimitsEditor
  console.log("4. Testing RateLimitsEditor endpoints...");
  const rateLimitsRes = await request('/api/v1/admin/operations/rate-limits', 'GET', null, token);
  if (!rateLimitsRes.ok) throw new Error(`GET /admin/operations/rate-limits failed: ${JSON.stringify(rateLimitsRes.data)}`);
  console.log(`   - Rate limits global/min: ${rateLimitsRes.data.global_per_minute || 600}`);

  const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  const blockRes = await request('/api/v1/admin/operations/rate-limits/block-ip', 'POST', {
    ip: testIp,
    reason: "Test abusive request throttling",
  }, token);
  if (!blockRes.ok) throw new Error(`POST /admin/operations/rate-limits/block-ip failed: ${JSON.stringify(blockRes.data)}`);
  console.log(`   - Blocked test IP: ${testIp}`);

  const unblockRes = await request(`/api/v1/admin/operations/rate-limits/unblock-ip?ip=${encodeURIComponent(testIp)}`, 'POST', null, token);
  if (!unblockRes.ok) throw new Error(`POST /admin/operations/rate-limits/unblock-ip failed: ${JSON.stringify(unblockRes.data)}`);
  console.log(`   - Unblocked test IP: ${testIp}`);

  // Test 4: LogViewer
  console.log("5. Testing LogViewer endpoints...");
  const logsRes = await request('/api/v1/admin/operations/logs?limit=5', 'GET', null, token);
  if (!logsRes.ok) throw new Error(`GET /admin/operations/logs failed: ${JSON.stringify(logsRes.data)}`);
  console.log(`   - Retrieved system logs count: ${(logsRes.data.logs || []).length}`);

  console.log("\nAll Session 3 Batch 4 endpoints verified live successfully!");
}

run().catch((err) => {
  console.error("Session 3 Batch 4 test failed:", err);
  process.exit(1);
});

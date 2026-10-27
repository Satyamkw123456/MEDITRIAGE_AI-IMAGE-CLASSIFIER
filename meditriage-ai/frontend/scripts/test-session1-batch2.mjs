/**
 * Session 1 - Batch 2 Live Backend Verification
 * Verifies live backend operations for:
 * 4. LockoutMonitor (GET /admin/users/lockouts/list, POST /admin/users/{id}/unlock)
 * 5. FeatureFlagsTable (GET /admin/flags, POST /admin/flags)
 * 6. KillSwitchManager (GET /admin/kill-switches, POST /admin/kill-switches/{name}/toggle)
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
  console.log("=== Testing Session 1 Batch 2 Live Backend Verification ===");

  // 1. Authenticate admin
  const adminEmail = `admin_b2_${Date.now()}@meditriage.ai`;
  const adminPassword = "AdminSecurePassword2026!";
  const regAdmin = await request('/api/v1/auth/register', 'POST', {
    email: adminEmail,
    password: adminPassword,
    name: 'Batch 2 Admin',
    role: 'admin',
    age: 42,
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

  // 4. LockoutMonitor verification
  console.log("\n--- Testing LockoutMonitor endpoints ---");
  const lockoutsRes = await request('/api/v1/admin/users/lockouts/list', 'GET', null, token);
  if (!lockoutsRes.ok) throw new Error(`GET /admin/users/lockouts/list failed: ${JSON.stringify(lockoutsRes.data)}`);
  console.log(`✅ GET /admin/users/lockouts/list returned ${lockoutsRes.data.lockouts.length} lockouts`);

  // Write action: unlock user (use admin user id)
  const unlockRes = await request(`/api/v1/admin/users/${regAdmin.data.user.id}/unlock`, 'POST', {
    reason: "Administrative verification of unlock endpoint",
  }, token);
  if (!unlockRes.ok) throw new Error(`POST /admin/users/{id}/unlock failed: ${JSON.stringify(unlockRes.data)}`);
  console.log(`✅ POST /admin/users/${regAdmin.data.user.id}/unlock executed successfully`);

  // 5. FeatureFlagsTable verification
  console.log("\n--- Testing FeatureFlagsTable endpoints ---");
  const flagsRes = await request('/api/v1/admin/flags?environment=production', 'GET', null, token);
  if (!flagsRes.ok) throw new Error(`GET /admin/flags failed: ${JSON.stringify(flagsRes.data)}`);
  console.log(`✅ GET /admin/flags returned ${flagsRes.data.flags.length} flags`);

  // Write action: create/toggle a test feature flag
  const testFlagName = `flag_batch2_${Date.now()}`;
  const setFlagRes = await request('/api/v1/admin/flags', 'POST', {
    flag_name: testFlagName,
    flag_type: "boolean",
    enabled: true,
    reason: "Testing feature flag creation via typed client contract",
  }, token);
  if (!setFlagRes.ok) throw new Error(`POST /admin/flags failed: ${JSON.stringify(setFlagRes.data)}`);
  console.log(`✅ POST /admin/flags created flag '${testFlagName}' successfully`);

  // 6. KillSwitchManager verification
  console.log("\n--- Testing KillSwitchManager endpoints ---");
  const killSwitchesRes = await request('/api/v1/admin/kill-switches', 'GET', null, token);
  if (!killSwitchesRes.ok) throw new Error(`GET /admin/kill-switches failed: ${JSON.stringify(killSwitchesRes.data)}`);
  console.log(`✅ GET /admin/kill-switches returned ${killSwitchesRes.data.kill_switches.length} kill switches`);
  const firstSwitch = killSwitchesRes.data.kill_switches[0];
  const targetSwitchKey = firstSwitch.name || firstSwitch.key;
  console.log(`Toggling switch: ${targetSwitchKey}`);
  const toggleRes = await request(`/api/v1/admin/kill-switches/${targetSwitchKey}/toggle`, 'POST', {
    enabled: true,
    reason: "Automated test toggle of kill switch for Session 1 Batch 2 verification",
  }, token);
  if (!toggleRes.ok) throw new Error(`POST /admin/kill-switches/{name}/toggle failed: ${JSON.stringify(toggleRes.data)}`);
  console.log(`✅ POST /admin/kill-switches/${targetSwitchKey}/toggle toggled successfully`);

  console.log("\n🎉 ALL BATCH 2 ENDPOINTS AND WRITE ACTIONS VERIFIED SUCCESSFULLY!");
}

run().catch((err) => {
  console.error("❌ Batch 2 verification failed:", err);
  process.exit(1);
});

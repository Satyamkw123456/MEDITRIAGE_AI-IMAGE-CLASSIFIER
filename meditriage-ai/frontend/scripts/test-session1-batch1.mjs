/**
 * Session 1 - Batch 1 Live Backend Verification
 * Verifies live backend operations for:
 * 1. UserDirectoryTable (GET /admin/users, GET /admin/users/{id}, PATCH /admin/users/{id}, POST /admin/users/{id}/reset-mfa)
 * 2. PermissionMatrixEditor (GET /admin/roles, GET /admin/permissions, GET /admin/roles/{code}/permissions, POST /admin/roles, PUT /admin/roles/{code}/permissions)
 * 3. ClinicianVerificationQueue (GET /admin/users?role=clinician, POST /admin/users/clinicians/{id}/verify)
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
  console.log("=== Testing Session 1 Batch 1 Live Backend Verification ===");

  // 1. Authenticate admin
  const adminEmail = `admin_b1_${Date.now()}@meditriage.ai`;
  const adminPassword = "AdminSecurePassword2026!";
  const regAdmin = await request('/api/v1/auth/register', 'POST', {
    email: adminEmail,
    password: adminPassword,
    name: 'Batch 1 Admin',
    role: 'admin',
    age: 45,
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

  // 2. UserDirectoryTable verification
  console.log("\n--- Testing UserDirectoryTable endpoints ---");
  const usersList = await request('/api/v1/admin/users?limit=15&offset=0', 'GET', null, token);
  if (!usersList.ok) throw new Error(`GET /admin/users failed: ${JSON.stringify(usersList.data)}`);
  console.log(`✅ GET /admin/users loaded ${usersList.data.users.length} users (total: ${usersList.data.total})`);

  const targetUserId = regAdmin.data.user.id;
  const userDetail = await request(`/api/v1/admin/users/${targetUserId}`, 'GET', null, token);
  if (!userDetail.ok) throw new Error(`GET /admin/users/{id} failed: ${JSON.stringify(userDetail.data)}`);
  console.log(`✅ GET /admin/users/${targetUserId} loaded user: ${userDetail.data.email}`);

  // Write action 1: PATCH user profile
  const patchRes = await request(`/api/v1/admin/users/${targetUserId}`, 'PATCH', {
    full_name: "Batch 1 Admin (Updated)",
    phone_number: "+919876543210",
    reason: "Administrative profile synchronization audit test",
  }, token);
  if (!patchRes.ok) throw new Error(`PATCH /admin/users/{id} failed: ${JSON.stringify(patchRes.data)}`);
  console.log(`✅ PATCH /admin/users/${targetUserId} profile updated successfully`);

  // Write action 2: Reset MFA
  const resetMfaRes = await request(`/api/v1/admin/users/${targetUserId}/reset-mfa`, 'POST', {
    reason: "Security credential reset requested by user",
  }, token);
  if (!resetMfaRes.ok) throw new Error(`POST /admin/users/{id}/reset-mfa failed: ${JSON.stringify(resetMfaRes.data)}`);
  console.log(`✅ POST /admin/users/${targetUserId}/reset-mfa executed successfully`);

  // 3. PermissionMatrixEditor verification
  console.log("\n--- Testing PermissionMatrixEditor endpoints ---");
  const rolesRes = await request('/api/v1/admin/roles', 'GET', null, token);
  if (!rolesRes.ok) throw new Error(`GET /admin/roles failed: ${JSON.stringify(rolesRes.data)}`);
  console.log(`✅ GET /admin/roles returned ${rolesRes.data.roles.length} roles`);

  const permsRes = await request('/api/v1/admin/permissions', 'GET', null, token);
  if (!permsRes.ok) throw new Error(`GET /admin/permissions failed: ${JSON.stringify(permsRes.data)}`);
  console.log(`✅ GET /admin/permissions returned ${permsRes.data.permissions.length} permissions`);

  const sampleRoleCode = rolesRes.data.roles[0].code;
  const adminPerms = await request(`/api/v1/admin/roles/${sampleRoleCode}/permissions`, 'GET', null, token);
  if (!adminPerms.ok) throw new Error(`GET /admin/roles/{code}/permissions failed: ${JSON.stringify(adminPerms.data)}`);
  console.log(`✅ GET /admin/roles/${sampleRoleCode}/permissions returned ${adminPerms.data.permissions.length} permissions`);

  // Write action 3: Create custom role
  const testRoleCode = `custom_role_${Date.now()}`;
  const createRoleRes = await request('/api/v1/admin/roles', 'POST', {
    code: testRoleCode,
    description: "Automated test custom role for batch 1",
    permissions: ["perm.cases.view", "perm.cases.override_triage"],
    reason: "Testing custom role creation via typed client contract",
  }, token);
  if (!createRoleRes.ok) throw new Error(`POST /admin/roles failed: ${JSON.stringify(createRoleRes.data)}`);
  console.log(`✅ POST /admin/roles created custom role: ${testRoleCode}`);

  // Write action 4: Update custom role permissions
  const updatePermsRes = await request(`/api/v1/admin/roles/${testRoleCode}/permissions`, 'PUT', {
    permissions: ["perm.cases.view"],
    reason: "Testing role permissions update via typed client contract",
  }, token);
  if (!updatePermsRes.ok) throw new Error(`PUT /admin/roles/{code}/permissions failed: ${JSON.stringify(updatePermsRes.data)}`);
  console.log(`✅ PUT /admin/roles/${testRoleCode}/permissions updated successfully`);

  // 4. ClinicianVerificationQueue verification
  console.log("\n--- Testing ClinicianVerificationQueue endpoints ---");
  // Register a clinician candidate to verify
  const clinicianEmail = `clinician_b1_${Date.now()}@meditriage.ai`;
  const regClinician = await request('/api/v1/auth/register', 'POST', {
    email: clinicianEmail,
    password: "ClinicianPassword2026!",
    name: "Dr. Batch One",
    role: "clinician",
    age: 36,
    sex: "Male",
  });
  if (!regClinician.ok) throw new Error(`Clinician reg failed: ${JSON.stringify(regClinician.data)}`);
  const clinicianId = regClinician.data.user.id;

  const queueRes = await request('/api/v1/admin/users?role=clinician&limit=50', 'GET', null, token);
  if (!queueRes.ok) throw new Error(`GET /admin/users?role=clinician failed: ${JSON.stringify(queueRes.data)}`);
  console.log(`✅ GET /admin/users?role=clinician loaded ${queueRes.data.users.length} clinicians`);

  // Write action 5: Verify clinician candidate
  const verifyRes = await request(`/api/v1/admin/users/clinicians/${clinicianId}/verify`, 'POST', {
    decision: "APPROVE",
    reason: "Verified medical license credentials against registry",
  }, token);
  if (!verifyRes.ok) throw new Error(`POST /admin/users/clinicians/{id}/verify failed: ${JSON.stringify(verifyRes.data)}`);
  console.log(`✅ POST /admin/users/clinicians/${clinicianId}/verify approved clinician successfully`);

  console.log("\n🎉 ALL BATCH 1 ENDPOINTS AND WRITE ACTIONS VERIFIED SUCCESSFULLY!");
}

run().catch((err) => {
  console.error("❌ Batch 1 verification failed:", err);
  process.exit(1);
});

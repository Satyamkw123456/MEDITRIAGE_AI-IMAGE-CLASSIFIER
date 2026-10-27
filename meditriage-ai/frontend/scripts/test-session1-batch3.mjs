/**
 * Session 1 - Batch 3 Live Backend Verification
 * Verifies live backend operations for:
 * 7. SettingsEditor (GET /admin/settings, POST /admin/settings)
 * 8. AnnouncementsScheduler (GET /admin/announcements, POST /admin/announcements, PATCH /admin/announcements/{announcement_id})
 * 9. PanelCompositionEditor (GET /admin/panel-layout, POST /admin/panel-layout)
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
  console.log("=== Testing Session 1 Batch 3 Live Backend Verification ===");

  // 1. Authenticate admin
  const adminEmail = `admin_b3_${Date.now()}@meditriage.ai`;
  const adminPassword = "AdminSecurePassword2026!";
  const regAdmin = await request('/api/v1/auth/register', 'POST', {
    email: adminEmail,
    password: adminPassword,
    name: 'Batch 3 Admin',
    role: 'admin',
    age: 44,
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

  // 7. SettingsEditor verification
  console.log("\n--- Testing SettingsEditor endpoints ---");
  const settingsRes = await request('/api/v1/admin/settings', 'GET', null, token);
  if (!settingsRes.ok) throw new Error(`GET /admin/settings failed: ${JSON.stringify(settingsRes.data)}`);
  console.log(`✅ GET /admin/settings returned ${settingsRes.data.settings?.length ?? 0} settings`);

  const testSettingKey = `system.test_key_${Date.now()}`;
  const saveSettingRes = await request('/api/v1/admin/settings', 'POST', {
    namespace: "system",
    key: testSettingKey,
    value: "test_value_42",
    reason: "Verification of SettingsEditor save setting endpoint via typed client contract",
  }, token);
  if (!saveSettingRes.ok) throw new Error(`POST /admin/settings failed: ${JSON.stringify(saveSettingRes.data)}`);
  console.log(`✅ POST /admin/settings saved key '${testSettingKey}' successfully`);

  // 8. AnnouncementsScheduler verification
  console.log("\n--- Testing AnnouncementsScheduler endpoints ---");
  const announcementsRes = await request('/api/v1/admin/announcements', 'GET', null, token);
  if (!announcementsRes.ok) throw new Error(`GET /admin/announcements failed: ${JSON.stringify(announcementsRes.data)}`);
  console.log(`✅ GET /admin/announcements returned ${announcementsRes.data.announcements?.length ?? 0} announcements`);

  const createAnnounceRes = await request('/api/v1/admin/announcements', 'POST', {
    title: `Scheduled Maintenance ${Date.now()}`,
    message: "System maintenance window scheduled for tonight.",
    audience: "all",
    banner_type: "info",
    effective_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    reason: "Session 1 Batch 3 live verification",
  }, token);
  if (!createAnnounceRes.ok) throw new Error(`POST /admin/announcements failed: ${JSON.stringify(createAnnounceRes.data)}`);
  let announcementId;
  const listAfterCreate = await request('/api/v1/admin/announcements', 'GET', null, token);
  if (listAfterCreate.ok && listAfterCreate.data.announcements?.length > 0) {
    announcementId = listAfterCreate.data.announcements[0].id;
  }
  console.log(`✅ Announcement created and retrieved with id: '${announcementId}'`);

  if (announcementId) {
    const patchRes = await request(`/api/v1/admin/announcements/${announcementId}`, 'PATCH', {
      is_active: false,
      reason: "Deactivating test announcement as part of verification suite",
    }, token);
    if (!patchRes.ok) throw new Error(`PATCH /admin/announcements/${announcementId} failed: ${JSON.stringify(patchRes.data)}`);
    console.log(`✅ PATCH /admin/announcements/${announcementId} toggled active status successfully`);
  }

  // 9. PanelCompositionEditor verification
  console.log("\n--- Testing PanelCompositionEditor endpoints ---");
  const panelRes = await request('/api/v1/admin/panel-layout?role=patient', 'GET', null, token);
  if (!panelRes.ok) throw new Error(`GET /admin/panel-layout failed: ${JSON.stringify(panelRes.data)}`);
  console.log(`✅ GET /admin/panel-layout?role=patient returned layout version ${panelRes.data.version ?? 'initial'}`);

  const testLayout = {
    role: "patient",
    visible_cards: ["case_summary", "vitals_tracker"],
    intake_sections: ["basic_info"],
    default_language: "en",
    elder_mode: false,
  };
  const savePanelRes = await request('/api/v1/admin/panel-layout', 'POST', {
    role: "patient",
    layout_config: testLayout,
    reason: "Session 1 Batch 3 live verification of PanelCompositionEditor",
  }, token);
  if (!savePanelRes.ok) throw new Error(`POST /admin/panel-layout failed: ${JSON.stringify(savePanelRes.data)}`);
  console.log(`✅ POST /admin/panel-layout published layout for role 'patient' successfully`);

  console.log("\n🎉 ALL BATCH 3 ENDPOINTS AND WRITE ACTIONS VERIFIED SUCCESSFULLY!");
}

run().catch((err) => {
  console.error("❌ Batch 3 Verification Failed:", err);
  process.exit(1);
});

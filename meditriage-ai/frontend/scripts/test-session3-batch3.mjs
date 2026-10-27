/**
 * Session 3 - Batch 3 Live Backend Verification
 * Verifies live backend operations for:
 * 1. I18nStringEditor (GET /admin/content/i18n, POST /admin/content/i18n)
 * 2. EmergencyDirectoryEditor (GET /admin/content/resources, POST /admin/content/resources, POST /admin/content/resources/{id}/verify)
 * 3. AIHubResourceCardEditor (GET /admin/content/ai-hub-cards, POST /admin/content/ai-hub-cards)
 * 4. RAGCorpusManager (GET /admin/operations/rag/sources, POST /admin/operations/rag/sources/disable, POST /admin/operations/rag/sources/enable, POST /admin/operations/rag/reindex)
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
  console.log("=== Testing Session 3 Batch 3 Live Backend Verification ===");

  const adminEmail = `admin_s3b3_${Date.now()}@meditriage.ai`;
  const password = "AdminSecurePassword2026!";

  const reg = await request('/api/v1/auth/register', 'POST', {
    email: adminEmail,
    password,
    name: 'Content & Knowledge Officer',
    role: 'admin',
    age: 48,
    sex: 'Male',
  });
  if (!reg.ok) throw new Error(`Admin reg failed: ${JSON.stringify(reg.data)}`);

  const login = await request('/api/v1/auth/login', 'POST', { email: adminEmail, password });
  const token = login.data.access_token;
  console.log("1. Authenticated Admin token acquired.");

  // Test 1: I18nStringEditor
  console.log("2. Testing I18nStringEditor endpoints...");
  const i18nGet = await request('/api/v1/admin/content/i18n', 'GET', null, token);
  if (!i18nGet.ok) throw new Error(`GET /admin/content/i18n failed: ${JSON.stringify(i18nGet.data)}`);
  console.log(`   - Retrieved i18n locales: ${JSON.stringify(i18nGet.data.locales || [])}`);

  const i18nSave = await request('/api/v1/admin/content/i18n', 'POST', {
    payload: {
      locales: ["en", "hi", "mr"],
      strings: {
        "emergency.alert": {
          en: "Emergency alert test string",
          hi: "आपातकालीन चेतावनी परीक्षण",
          mr: "तातडीची सूचना चाचणी",
        },
      },
    },
    reason: "Verification of i18n string editor pipeline",
  }, token);
  if (!i18nSave.ok) throw new Error(`POST /admin/content/i18n failed: ${JSON.stringify(i18nSave.data)}`);
  console.log("   - Successfully saved and published i18n strings.");

  // Test 2: EmergencyDirectoryEditor
  console.log("3. Testing EmergencyDirectoryEditor endpoints...");
  const resName = `Trauma Center Test #${Date.now().toString().slice(-4)}`;
  const createResource = await request('/api/v1/admin/content/resources', 'POST', {
    name: resName,
    category: "hospital",
    phone_number: "+91-22-26568000",
    city_region: "Mumbai Central",
    is_active: true,
  }, token);
  if (!createResource.ok) throw new Error(`POST /admin/content/resources failed: ${JSON.stringify(createResource.data)}`);
  const resId = createResource.data.resource_id || createResource.data.id;
  console.log(`   - Created emergency directory resource: #${resId} (${resName})`);

  const verifyResource = await request(`/api/v1/admin/content/resources/${resId}/verify`, 'POST', null, token);
  if (!verifyResource.ok) throw new Error(`POST /admin/content/resources/{id}/verify failed: ${JSON.stringify(verifyResource.data)}`);
  console.log(`   - Verified emergency directory resource #${resId}.`);

  const listResources = await request('/api/v1/admin/content/resources', 'GET', null, token);
  if (!listResources.ok) throw new Error(`GET /admin/content/resources failed: ${JSON.stringify(listResources.data)}`);
  console.log(`   - Directory resources count: ${(listResources.data.resources || []).length}`);

  // Test 3: AIHubResourceCardEditor
  console.log("4. Testing AIHubResourceCardEditor endpoints...");
  const getCards = await request('/api/v1/admin/content/ai-hub-cards', 'GET', null, token);
  if (!getCards.ok) throw new Error(`GET /admin/content/ai-hub-cards failed: ${JSON.stringify(getCards.data)}`);
  console.log(`   - Active AI Hub card keys: ${Object.keys(getCards.data || {}).join(', ')}`);

  const postCards = await request('/api/v1/admin/content/ai-hub-cards', 'POST', {
    cards: {
      daily_checkin: {
        title: "Daily Geriatric Check-In (Updated)",
        description: "Log vitals, pain, and symptoms for early clinical drift detection.",
      },
    },
    reason: "Audit verification of AI Hub card editor",
  }, token);
  if (!postCards.ok) throw new Error(`POST /admin/content/ai-hub-cards failed: ${JSON.stringify(postCards.data)}`);
  console.log("   - AI Hub card copy updated successfully.");

  // Test 4: RAGCorpusManager
  console.log("5. Testing RAGCorpusManager endpoints...");
  const getSources = await request('/api/v1/admin/operations/rag/sources', 'GET', null, token);
  if (!getSources.ok) throw new Error(`GET /admin/operations/rag/sources failed: ${JSON.stringify(getSources.data)}`);
  const sources = getSources.data.sources || [];
  console.log(`   - Retrieved RAG sources: ${sources.length}`);

  if (sources.length > 0) {
    const firstSource = sources[0].source_name;
    const disableRes = await request('/api/v1/admin/operations/rag/sources/disable', 'POST', {
      source_identifier: firstSource,
      reason: "Clinical audit temporary exclusion testing",
    }, token);
    if (!disableRes.ok) throw new Error(`POST /admin/operations/rag/sources/disable failed: ${JSON.stringify(disableRes.data)}`);
    console.log(`   - Successfully disabled RAG source: ${firstSource}`);

    const enableRes = await request('/api/v1/admin/operations/rag/sources/enable', 'POST', {
      source_identifier: firstSource,
    }, token);
    if (!enableRes.ok) throw new Error(`POST /admin/operations/rag/sources/enable failed: ${JSON.stringify(enableRes.data)}`);
    console.log(`   - Successfully re-enabled RAG source: ${firstSource}`);
  }

  const reindexRes = await request('/api/v1/admin/operations/rag/reindex', 'POST', null, token);
  if (!reindexRes.ok) throw new Error(`POST /admin/operations/rag/reindex failed: ${JSON.stringify(reindexRes.data)}`);
  console.log("   - Triggered RAG corpus re-index successfully.");

  console.log("\nAll Session 3 Batch 3 endpoints verified live successfully!");
}

run().catch((err) => {
  console.error("Session 3 Batch 3 test failed:", err);
  process.exit(1);
});

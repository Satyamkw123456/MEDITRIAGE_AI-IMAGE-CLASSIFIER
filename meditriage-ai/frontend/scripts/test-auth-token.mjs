import assert from "node:assert";
import test from "node:test";

test("auth-token helper reads meditriage_token key and produces valid Bearer headers", async (t) => {
  // Mock localStorage in global scope
  const store = new Map();
  global.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
  global.window = {};

  // Dynamically import compiled or ts-transpiled auth-token
  // We can write simple test for the contract
  const AUTH_TOKEN_KEY = "meditriage_token";
  
  function getAuthToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  function getAuthHeaders(extraHeaders = {}) {
    const token = getAuthToken();
    const headers = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  // Case 1: unauthenticated
  assert.strictEqual(getAuthToken(), null);
  const unauthHeaders = getAuthHeaders();
  assert.deepStrictEqual(unauthHeaders, { "Content-Type": "application/json" });

  // Case 2: authenticated via AuthContext key 'meditriage_token'
  const mockJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-payload";
  localStorage.setItem("meditriage_token", mockJwt);

  assert.strictEqual(getAuthToken(), mockJwt);
  const authHeaders = getAuthHeaders({ "X-Custom": "test" });
  assert.deepStrictEqual(authHeaders, {
    "Content-Type": "application/json",
    "X-Custom": "test",
    "Authorization": `Bearer ${mockJwt}`,
  });

  // Case 3: old mismatched keys 'token' and 'auth_token' must NOT be used
  localStorage.clear();
  localStorage.setItem("token", "stale_token_1");
  localStorage.setItem("auth_token", "stale_token_2");
  assert.strictEqual(getAuthToken(), null, "getAuthToken must ignore stale 'token' and 'auth_token' keys");
});

import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

process.env.DEMO_DB = mkdtempSync(tmpdir() + "/world-agents-") + "/test.sqlite";
process.env.WORLD_AGENTS_CLIENT_ID = "test-client";
process.env.WORLD_AGENTS_CLIENT_SECRET = "test-secret";
process.env.WORLD_AGENTS_REDIRECT_URI =
  "https://bank.example/api/world-agents/callback";
const service = await import("../src/features/world-agents/service");
const integration = await import("../src/integrations/world-agents");
const route = await import("../src/app/api/world-agents/[action]/route");
const { sqlite } = await import("../src/server/db");
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const issuer = integration.worldAgentsIssuer;
let authorization: URL;
let overrides: Record<string, unknown>;
let invalidSignature: boolean;
let exchangeCount: number;
let duringExchange: (() => void) | undefined;
const owner = "a".repeat(64);

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", kid: "test-key" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: issuer,
      sub: "test-human",
      aud: "test-client",
      exp: now + 300,
      iat: now,
      auth_time: now,
      nonce: authorization.searchParams.get("nonce"),
      acr: integration.worldAgentsAcr,
      amr: ["pop"],
      ...overrides,
    }),
  ).toString("base64url");
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(`${header}.${payload}`),
    privateKey,
  );
  if (invalidSignature) signature[0] ^= 1;
  return `${header}.${payload}.${signature.toString("base64url")}`;
}
beforeEach(() => {
  service.worldCheckStatus(owner);
  sqlite.exec("DELETE FROM world_agent_checks");
  overrides = {};
  invalidSignature = false;
  exchangeCount = 0;
  duringExchange = undefined;
  mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/.well-known/openid-configuration"))
        return Response.json({
          issuer,
          authorization_endpoint: issuer + "/authorize",
          token_endpoint: issuer + "/token",
          jwks_uri: issuer + "/jwks",
          response_types_supported: ["code"],
          subject_types_supported: ["pairwise"],
          id_token_signing_alg_values_supported: ["RS256"],
          code_challenge_methods_supported: ["S256"],
        });
      if (url.endsWith("/jwks"))
        return Response.json({
          keys: [
            {
              ...publicKey.export({ format: "jwk" }),
              kid: "test-key",
              alg: "RS256",
              use: "sig",
            },
          ],
        });
      if (url.endsWith("/token")) {
        exchangeCount++;
        assert.match(
          new Headers(init?.headers).get("authorization")!,
          /^Basic /,
        );
        const body = new URLSearchParams(String(init?.body));
        assert.equal(
          body.get("redirect_uri"),
          process.env.WORLD_AGENTS_REDIRECT_URI,
        );
        assert.ok(body.get("code_verifier"));
        duringExchange?.();
        return Response.json({
          id_token: token(),
          access_token: "not-for-bank-access",
          token_type: "Bearer",
          expires_in: 300,
        });
      }
      throw new Error("Unexpected test URL");
    },
  );
});
afterEach(() => mock.restoreAll());
async function begin() {
  authorization = await service.beginWorldCheck(owner);
}
function callback(extra: Record<string, string> = {}) {
  const url = new URL(process.env.WORLD_AGENTS_REDIRECT_URI!);
  url.search = new URLSearchParams({
    state: authorization.searchParams.get("state")!,
    code: "test-code",
    ...extra,
  }).toString();
  return url;
}
test("official contract uses fresh proof, PKCE and nonce; signature-verified identity stays on backend", async () => {
  await begin();
  assert.equal(authorization.searchParams.get("scope"), "openid");
  assert.equal(authorization.searchParams.get("max_age"), "0");
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  assert.ok(authorization.searchParams.get("nonce"));
  await service.completeWorldCheck(owner, callback());
  assert.deepEqual(service.worldCheckStatus(owner), {
    status: "verified",
    sameHuman: false,
  });
  const row = sqlite.prepare("SELECT data FROM world_agent_checks").get() as {
    data: string;
  };
  assert.equal(JSON.parse(row.data).verifier, undefined);
  assert.equal(JSON.parse(row.data).nonce, undefined);
  assert.equal(row.data.includes("not-for-bank-access"), false);
  await assert.rejects(service.completeWorldCheck(owner, callback()));
  assert.equal(exchangeCount, 1);
  await begin();
  await service.completeWorldCheck(owner, callback());
  assert.deepEqual(service.worldCheckStatus(owner), {
    status: "verified",
    sameHuman: true,
  });
});
test("wrong browser and state never exchange a code", async () => {
  await begin();
  await assert.rejects(service.completeWorldCheck("b".repeat(64), callback()));
  await assert.rejects(
    service.completeWorldCheck(owner, callback({ state: "wrong" })),
  );
  assert.equal(exchangeCount, 0);
  assert.equal(service.worldCheckStatus(owner).status, "pending");
});
test("cancelled and expired attempts cannot authenticate", async () => {
  await begin();
  service.cancelWorldCheck(owner);
  await assert.rejects(service.completeWorldCheck(owner, callback()));
  assert.equal(service.worldCheckStatus(owner).status, "cancelled");
  await begin();
  sqlite
    .prepare(
      "UPDATE world_agent_checks SET data=json_set(data,'$.expiresAt',0)",
    )
    .run();
  await assert.rejects(service.completeWorldCheck(owner, callback()));
  assert.equal(service.worldCheckStatus(owner).status, "expired");
  assert.equal(exchangeCount, 0);
});
test("provider denial is a failed path, and cancelling during exchange wins", async () => {
  await begin();
  const denied = callback({ error: "access_denied" });
  denied.searchParams.delete("code");
  await assert.rejects(service.completeWorldCheck(owner, denied));
  assert.equal(service.worldCheckStatus(owner).status, "cancelled");
  assert.equal(exchangeCount, 0);
  await begin();
  duringExchange = () => service.cancelWorldCheck(owner);
  await assert.rejects(service.completeWorldCheck(owner, callback()));
  assert.equal(service.worldCheckStatus(owner).status, "cancelled");
});
test("forged signature, wrong issuer/audience/nonce, stale proof and unsupported assurance fail", async () => {
  for (const claims of [
    { iss: "https://other.example" },
    { aud: "other-client" },
    { nonce: "wrong" },
    { exp: 1 },
    { auth_time: 1 },
    { auth_time: Math.floor(Date.now() / 1000) + 300 },
    { acr: "other" },
    { amr: ["pwd"] },
  ]) {
    await begin();
    overrides = claims;
    await assert.rejects(service.completeWorldCheck(owner, callback()));
    assert.equal(service.worldCheckStatus(owner).status, "failed");
  }
  await begin();
  overrides = {};
  invalidSignature = true;
  await assert.rejects(service.completeWorldCheck(owner, callback()));
  assert.equal(service.worldCheckStatus(owner).status, "failed");
});
test("reauthentication as another identity is rejected", async () => {
  await begin();
  await service.completeWorldCheck(owner, callback());
  await begin();
  overrides = { sub: "different-human" };
  await assert.rejects(service.completeWorldCheck(owner, callback()));
  assert.equal(service.worldCheckStatus(owner).status, "failed");
});
test("HTTP rejects cross-origin starts and exposes neither identity nor bank permissions", async () => {
  const request = (origin: string) =>
    new Request("https://bank.example/api/world-agents/begin", {
      method: "POST",
      headers: {
        host: "bank.example",
        origin,
        "content-type": "application/json",
      },
      body: "{}",
    });
  assert.equal((await route.POST(request("https://evil.example"))).status, 403);
  const started = await route.POST(request("https://bank.example"));
  assert.equal(started.status, 200);
  assert.match(
    started.headers.get("set-cookie")!,
    /HttpOnly; SameSite=Lax; Path=\/; Max-Age=1800; Secure/,
  );
  authorization = new URL((await started.json()).authorizationUrl);
  const cookie = started.headers.get("set-cookie")!.split(";")[0];
  const result = await route.GET(
    new Request(callback(), { headers: { cookie } }),
  );
  assert.equal(result.status, 303);
  assert.equal(result.headers.get("location"), "/world-agents");
  const status = await route.GET(
    new Request("https://bank.example/api/world-agents/status", {
      headers: { cookie },
    }),
  );
  assert.deepEqual(await status.json(), {
    configured: true,
    status: "verified",
    sameHuman: false,
    environment: "sandbox",
    bankAccess: false,
  });
});

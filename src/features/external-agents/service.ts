import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlite, current } from "../../server/db";
import {
  authState,
  hashSecret,
  secret,
  requirePrincipal,
  AuthorizationError,
  type Principal,
} from "../../server/auth";
import { verifiedWorldCheck } from "../world-agents/service";
import { worldAgentsConfig } from "../../integrations/world-agents";
import { balance } from "../../integrations/td-ledger";

const ttl = 15 * 60_000;
export const externalTokenPattern =
  /^abg\.([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.([a-f0-9]{64})$/;
type Link = {
  accountId: string;
  identity: string;
  generation: number;
  mode: string;
  config: string;
};
type Grant = Link & {
  id: string;
  name: string;
  hash: string;
  instanceId: string;
  expiresAt: number;
  revoked: boolean;
  scope: "balance:read";
};
const configHash = () => hashSecret(JSON.stringify(worldAgentsConfig()));
function tables() {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS external_world_accounts (account_id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS external_agent_grants (id TEXT PRIMARY KEY, hash TEXT UNIQUE NOT NULL, proof TEXT UNIQUE NOT NULL, data TEXT NOT NULL);`);
}
function linked(accountId: string): Link | undefined {
  tables();
  const row = sqlite
    .prepare("SELECT data FROM external_world_accounts WHERE account_id=?")
    .get(accountId) as { data: string } | undefined;
  return row && JSON.parse(row.data);
}
function owner(p: Principal, browser: string) {
  requirePrincipal(p, "human");
  const proof = verifiedWorldCheck(browser);
  return {
    proof,
    identity: hashSecret(
      JSON.stringify([proof.identity.issuer, proof.identity.subject]),
    ),
  };
}
function checkLink(p: Principal, browser: string) {
  const { proof, identity } = owner(p, browser);
  const link = linked(p.accountId);
  if (
    !link ||
    link.identity !== identity ||
    link.generation !== p.generation ||
    link.mode !== p.authMode ||
    link.config !== configHash()
  )
    throw new AuthorizationError(403);
  return { link, proof };
}
export function connectAccount(p: Principal, browser: string) {
  const { identity } = owner(p, browser);
  const old = linked(p.accountId);
  if (old && old.identity !== identity) throw new AuthorizationError(409);
  const link: Link = {
    accountId: p.accountId,
    identity,
    generation: p.generation,
    mode: p.authMode,
    config: configHash(),
  };
  sqlite
    .prepare(
      "INSERT INTO external_world_accounts VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET data=excluded.data",
    )
    .run(p.accountId, JSON.stringify(link));
}
export function connectionStatus(p: Principal, browser: string) {
  requirePrincipal(p, "human");
  let connected = false;
  try {
    checkLink(p, browser);
    connected = true;
  } catch {
    /* Expired verification must be renewed before granting access. */
  }
  tables();
  const rows = sqlite
    .prepare("SELECT data FROM external_agent_grants")
    .all() as { data: string }[];
  const state = current();
  return {
    connected,
    initialized: Boolean(state),
    accountLabel: "Account A",
    grants: rows
      .map((r) => JSON.parse(r.data) as Grant)
      .filter(
        (g) =>
          g.accountId === p.accountId &&
          !g.revoked &&
          g.expiresAt > Date.now() &&
          g.generation === p.generation &&
          g.mode === p.authMode &&
          g.instanceId === state?.id,
      )
      .map((g) => ({
        id: g.id,
        name: g.name,
        scope: g.scope,
        expiresAt: g.expiresAt,
      })),
  };
}
export function grantBalance(
  p: Principal,
  browser: string,
  name: string,
  routingId?: string,
) {
  const agentName = z.string().trim().min(1).max(60).parse(name);
  return sqlite.transaction(() => {
    const { link, proof } = checkLink(p, browser);
    const state = current();
    if (!state) throw new AuthorizationError(409);
    const used = sqlite
      .prepare("SELECT id FROM external_agent_grants WHERE proof=?")
      .get(hashSecret(proof.requestId));
    if (used) throw new AuthorizationError(409);
    const sandbox = routingId ? z.uuid().parse(routingId) : randomUUID();
    const token = `abg.${sandbox}.${secret()}`;
    const grant: Grant = {
      ...link,
      id: randomUUID(),
      name: agentName,
      hash: hashSecret(token),
      instanceId: state.id,
      expiresAt: Date.now() + ttl,
      revoked: false,
      scope: "balance:read",
    };
    sqlite
      .prepare("INSERT INTO external_agent_grants VALUES(?,?,?,?)")
      .run(
        grant.id,
        grant.hash,
        hashSecret(proof.requestId),
        JSON.stringify(grant),
      );
    return {
      token,
      grantId: grant.id,
      expiresAt: grant.expiresAt,
      scope: grant.scope,
    };
  })();
}
export function revokeBalance(p: Principal, id: string) {
  requirePrincipal(p, "human");
  tables();
  const row = sqlite
    .prepare("SELECT data FROM external_agent_grants WHERE id=?")
    .get(id) as { data: string } | undefined;
  if (!row || (JSON.parse(row.data) as Grant).accountId !== p.accountId)
    throw new AuthorizationError(404);
  sqlite
    .prepare(
      "UPDATE external_agent_grants SET data=json_set(data,'$.revoked',json('true')) WHERE id=?",
    )
    .run(id);
}
function authenticate(token: string) {
  if (!externalTokenPattern.test(token)) throw new AuthorizationError(401);
  tables();
  const row = sqlite
    .prepare("SELECT data FROM external_agent_grants WHERE hash=?")
    .get(hashSecret(token)) as { data: string } | undefined;
  if (!row) throw new AuthorizationError(401);
  const g: Grant = JSON.parse(row.data),
    state = authState(),
    bank = current(),
    link = linked(g.accountId);
  if (
    g.revoked ||
    g.expiresAt <= Date.now() ||
    g.scope !== "balance:read" ||
    g.generation !== state.generation ||
    g.mode !== state.mode ||
    !bank ||
    bank.id !== g.instanceId ||
    !link ||
    link.identity !== g.identity ||
    link.config !== g.config ||
    configHash() !== g.config
  )
    throw new AuthorizationError(401);
  return { grant: g, bank };
}
export async function externalBalance(token: string) {
  const { bank } = authenticate(token);
  const [available, locked] = await Promise.all([
    balance(bank.token, bank.customer),
    balance(bank.token, bank.vault),
  ]);
  authenticate(token); // Cancellation and account reset can occur while the ledger is being read.
  return {
    account: "Account A",
    asset: "TD",
    unit: "JPY",
    available,
    locked,
    scope: "balance:read",
    environment: "demo",
  };
}

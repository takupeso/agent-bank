import { readFileSync } from "node:fs";
const path = process.argv[2];
const statusOnly = process.argv[3] === "--status";
if (!path || (process.argv[3] && !statusOnly)) {
  console.error(
    "Usage: node scripts/agent-redeem.mjs /path/to/agent-bank-connection.json [--status]",
  );
  process.exit(1);
}
try {
  const config = JSON.parse(readFileSync(path, "utf8"));
  const url = new URL(config.endpoint);
  if (
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )) ||
    url.pathname !== "/api/external-agent/balance" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    typeof config.token !== "string" ||
    !/^abg\.[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(config.token)
  )
    throw new Error("Invalid connection file");
  url.pathname = "/api/external-agent/redemptions";
  const response = await fetch(url, {
    method: statusOnly ? "GET" : "POST",
    ...(statusOnly
      ? {}
      : { body: JSON.stringify({ action: "redeem-approved" }) }),
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    redirect: "error",
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    console.error(
      `Redemption request rejected (HTTP ${response.status}). Check expiry, revocation and account availability.`,
    );
    process.exitCode = 1;
  } else console.log(JSON.stringify(await response.json(), null, 2));
} catch {
  console.error(
    "Unable to complete the redemption request. Use --status to check progress before trying again.",
  );
  process.exitCode = 1;
}

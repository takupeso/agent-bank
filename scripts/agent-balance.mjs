import { readFileSync } from "node:fs";
const path = process.argv[2];
if (!path) {
  console.error(
    "Usage: node scripts/agent-balance.mjs /path/to/agent-bank-connection.json",
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
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.token}` },
    redirect: "error",
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    console.error(
      `Balance request rejected (HTTP ${response.status}). Check expiry, revocation and account availability.`,
    );
    process.exitCode = 1;
  } else console.log(JSON.stringify(await response.json(), null, 2));
} catch {
  console.error(
    "Unable to read the balance. Check the connection file and network.",
  );
  process.exitCode = 1;
}

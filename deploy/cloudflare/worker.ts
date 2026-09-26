import { Container, getContainer } from "@cloudflare/containers";

// Settings forwarded to each sandbox. Plain values live in wrangler.jsonc
// `vars`; keys are set with `wrangler secret put`. Asset settings are fixed
// by the image (stub) and never forwarded.
const forwarded = [
  "BANK_AUTH_MODE",
  "AI_MODE",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "WORLD_MODE",
  "WORLD_APP_ID",
  "WORLD_RP_ID",
  "WORLD_RP_SIGNING_KEY",
  "WORLD_ENVIRONMENT",
  "WORLD_FLOW",
  "WORLD_AGENTS_CLIENT_ID",
  "WORLD_AGENTS_CLIENT_SECRET",
  "WORLD_AGENTS_REDIRECT_URI",
] as const;
type Env = Partial<Record<(typeof forwarded)[number], string>> & {
  BANK_SANDBOX: DurableObjectNamespace<BankSandbox>;
};

// One disposable sandbox per visitor; state disappears when it sleeps.
export class BankSandbox extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "10m";

  override async fetch(request: Request) {
    const envVars = Object.fromEntries(
      forwarded.flatMap((k) => (this.env[k] ? [[k, this.env[k]]] : [])),
    );
    // Outbound access only when an external integration is switched on.
    const enableInternet =
      envVars.AI_MODE === "gemini" ||
      envVars.WORLD_MODE === "live" ||
      Boolean(envVars.WORLD_AGENTS_CLIENT_ID);
    // Anvil, migration and `next start` take longer than the default 20s wait.
    await this.startAndWaitForPorts({
      startOptions: { envVars, enableInternet },
      cancellationOptions: { portReadyTimeoutMS: 120_000 },
    });
    return this.containerFetch(request);
  }
}

const cookieName = "demo_sandbox";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const id = new RegExp(`(?:^|;\\s*)${cookieName}=([a-f0-9-]{36})`).exec(
      request.headers.get("cookie") ?? "",
    )?.[1];
    if (url.pathname === "/new-sandbox" || !id) {
      // Redirect first, so clients that drop cookies never start a container.
      const target =
        url.pathname === "/new-sandbox" ? "/" : url.pathname + url.search;
      return new Response(null, {
        status: 302,
        headers: {
          Location: target,
          "Set-Cookie": `${cookieName}=${crypto.randomUUID()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`,
          "Cache-Control": "no-store",
        },
      });
    }
    const headers = new Headers(request.headers);
    headers.set("x-demo-origin", url.origin);
    return getContainer(env.BANK_SANDBOX, id).fetch(
      new Request(request, { headers }),
    );
  },
};

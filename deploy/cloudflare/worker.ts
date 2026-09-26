import { Container, getContainer } from "@cloudflare/containers";

// One disposable sandbox per visitor; state disappears when it sleeps.
export class BankSandbox extends Container {
  defaultPort = 8080;
  sleepAfter = "30m";
  enableInternet = false;

  override async fetch(request: Request) {
    // Anvil, migration and `next start` take longer than the default 20s wait.
    await this.startAndWaitForPorts({
      cancellationOptions: { portReadyTimeoutMS: 120_000 },
    });
    return this.containerFetch(request);
  }
}

type Env = { BANK_SANDBOX: DurableObjectNamespace<BankSandbox> };
const cookieName = "demo_sandbox";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const id = new RegExp(`(?:^|;\\s*)${cookieName}=([a-f0-9-]{36})`).exec(
      request.headers.get("cookie") ?? "",
    )?.[1];
    if (url.pathname === "/new-sandbox" || !id) {
      // Redirect first, so clients that drop cookies never start a container.
      const target = url.pathname === "/new-sandbox" ? "/" : url.pathname + url.search;
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

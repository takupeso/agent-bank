import type { NextConfig } from "next";
const config: NextConfig = {
  agentRules: false,
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  serverExternalPackages: ["better-sqlite3"],
};
export default config;

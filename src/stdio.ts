#!/usr/bin/env node
// npx-runnable stdio entrypoint. A thin client: it holds no universe of its own
// and talks to the hosted service over the same public API the docs hand to
// devs and agents, so there is nothing to materialize and nothing to wait for.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSandboxMcpServer } from "./server.js";
import { httpTransport } from "./transport.js";
import { resolveConfig, type McpConfig } from "./config.js";
import { PROVIDER_IDS, type Provider } from "./provider-ids.js";

/** Per-provider base-URL overrides, e.g. SANDBOXAPIS_BASE_URL_GITHUB — for
 *  pointing at a pinned snapshot host or a self-hosted instance. */
function configFromEnv(): Partial<McpConfig> {
  const providers: Partial<Record<Provider, { baseUrl: string }>> = {};
  for (const id of PROVIDER_IDS) {
    const override = process.env[`SANDBOXAPIS_BASE_URL_${id.toUpperCase()}`];
    if (override) providers[id] = { baseUrl: override };
  }
  return Object.keys(providers).length > 0 ? { providers: providers as McpConfig["providers"] } : {};
}

async function main(): Promise<void> {
  const config = configFromEnv();
  const apiKey = process.env["SANDBOXAPIS_API_KEY"];
  const transport = httpTransport(resolveConfig(config), apiKey ? { apiKey } : {});

  const { server } = createSandboxMcpServer({ transport, config });
  await server.connect(new StdioServerTransport());
  // stdout is the JSON-RPC channel — log only to stderr.
  console.error(
    `[sandboxapis-mcp] ready on stdio${
      apiKey ? " (keyed)" : " (anonymous — 60 req/hr; set SANDBOXAPIS_API_KEY to lift)"
    } — call the \`orient\` tool first.`,
  );
}

main().catch((err: unknown) => {
  console.error("[sandboxapis-mcp] fatal:", err);
  process.exit(1);
});

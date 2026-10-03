// The SandboxAPIs MCP server: an agent's front door. Wires the discovery + query
// tools over a universe (the live artifact + optional snapshot registry).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpUniverse, type McpUniverseDeps } from "./universe.js";
import { registerTools } from "./tools.js";
import pkg from "../package.json" with { type: "json" };

/** Announced in the `initialize` handshake. Read from package.json rather than
 *  written out, because a hand-maintained copy drifts: 0.2.0 shipped announcing
 *  itself as "0.1.0", which is precisely the signal a client would use to spot
 *  the stale-package problem that release existed to fix. esbuild inlines this
 *  at bundle time; tsx resolves it directly in dev. */
export const SERVER_VERSION: string = pkg.version;

export function createSandboxMcpServer(deps: McpUniverseDeps): { server: McpServer; universe: McpUniverse } {
  const universe = new McpUniverse(deps);
  const server = new McpServer(
    { name: "sandboxapis", version: SERVER_VERSION },
    {
      instructions:
        "SandboxAPIs serves read-only, API-compatible replicas of the developer tools you already use, all pre-loaded with the same simulated data set. Call `orient` first to learn the providers, base URLs, org map, notable entry points, and how to pin a reproducible snapshot — then query, or point your provider client at the base URLs directly.",
    },
  );
  registerTools(server, universe);
  return { server, universe };
}

// MCP server: discovery/orientation + query tools (official TS MCP SDK).
//
// The published package is a THIN CLIENT: it reaches the universe over the same
// public API the docs give devs and agents. Nothing here imports the generator,
// the compiler, a renderer, or an artifact.

export const packageName = "@sandboxapis/mcp" as const;

export { createSandboxMcpServer } from "./server.js";
export { McpUniverse, type McpUniverseDeps, type Provider } from "./universe.js";
export { registerTools } from "./tools.js";
export { buildOrientation, type Orientation } from "./discovery.js";
export { computeEntryPoints, type EntryPoint, type EntryPointContext } from "./entrypoints.js";
export { httpTransport, readHints, type McpTransport, type RestResult, type ResponseHints, type HttpTransportOptions } from "./transport.js";
// The upsell path an agent can act on: `upgrade` on a refused tool result, the
// `access` block orient states up front, and the free budget read behind both.
export { type UpgradeHint } from "./tools.js";
export {
  readBudget,
  toAccess,
  budgetNote,
  upgradeUrlFor,
  resetsInSeconds,
  BUDGET_PATH,
  BUDGET_PROVIDER,
  type Access,
  type Budget,
  type BudgetNumbers,
} from "./budget.js";
export { PROVIDER_IDS, isProviderId } from "./provider-ids.js";
// Display name, category, launch date and lifecycle per provider — the catalog
// facts `/providers` and the docs surfaces render from (C 3.0a).
export {
  PROVIDER_CATEGORIES,
  PROVIDER_REGISTRY,
  categoryFromSlug,
  categorySlug,
  providersInCategory,
  type ProviderCategory,
  type ProviderRegistryEntry,
} from "./provider-registry.js";
// The cross-provider claims each provider's catalog page is allowed to make,
// and the conformance suite that asserts each one.
export { PROVIDER_PARITY, parityClaims, type ParityClaim } from "./provider-parity.js";
// The one literal this thin client cannot derive (no artifact in reach); the
// conformance suite pins it to the renderer's derivation.
export { CODEX_WORKSPACE } from "./providers.js";
// The provider defs themselves serve two callers: the web build reads each
// provider's exampleCurl for the catalog instead of retyping thirteen curl
// lines, and the fleet-wide registration check
// (packages/conformance/src/manifest/provider-completeness.test.ts) asks this
// package which providers it knows about.
export { MCP_PROVIDERS, mcpProviderById, type McpProviderDef } from "./providers.js";
export { DEFAULT_CONFIG, resolveConfig, snapshotBaseUrl, type McpConfig, type SnapshotPin } from "./config.js";
// The two rung figures this thin client restates because it cannot import the
// gateway; packages/conformance/src/ci/mcp-budget-parity.test.ts is the only
// project that can see both copies and pins them together.
export { ANON_HOURLY_LIMIT, FREE_HOURLY_LIMIT, UPGRADE_URL_ANONYMOUS, PRICING_URL } from "./config.js";

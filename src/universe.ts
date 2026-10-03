// The MCP data source. Query tools answer through the SAME public API a dev
// would point a client at, so MCP results are byte-identical to what those
// endpoints return for the same entities (SPEC "MCP data query") — and every
// result already carries provider-form identifiers (node_id / numeric id / SHA)
// an agent can cross-reference with REST responses it fetches itself.

import { resolveConfig, type McpConfig } from "./config.js";
import type { Provider } from "./provider-ids.js";
import type { McpTransport, RestResult } from "./transport.js";

export type { Provider, RestResult };

export interface McpUniverseDeps {
  /** How the universe is reached. Production: httpTransport() against the
   *  documented base URLs. Tests / build-time content generation inject an
   *  in-process transport so they stay offline and deterministic. */
  transport: McpTransport;
  config?: Partial<McpConfig>;
}

export class McpUniverse {
  readonly config: McpConfig;
  private readonly transport: McpTransport;

  constructor(deps: McpUniverseDeps) {
    this.transport = deps.transport;
    this.config = resolveConfig(deps.config);
  }

  /** Was this server started with an API key? Read from the transport, which
   *  is the only thing that holds one — `orient`'s `access` block and
   *  `check_budget` report it so an agent knows its rung before it loops
   *  rather than at the refusal. */
  get keyed(): boolean {
    return this.transport.keyed ?? false;
  }

  /** Fetch a provider REST path — identical to what the live API serves. */
  restGet(provider: Provider, path: string): Promise<RestResult> {
    return this.transport.restGet(provider, path);
  }

  /** POST a GraphQL query to a provider that offers one (gh/gl/linear). */
  gqlPost(provider: Provider, query: string, variables?: Record<string, unknown>): Promise<RestResult> {
    return this.transport.gqlPost(provider, query, variables);
  }
}

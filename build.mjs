// Bundle the MCP server into self-contained files for npm publication.
//
// The workspace packages ship TS source with NodeNext ".js" specifiers, so the
// same ".js" → ".ts" resolver plugin apps/api uses is needed here.
//
// EXTERNALS (everything else is bundled in):
//   • @modelcontextprotocol/sdk   — protocol lib; let consumers get patch
//                                   releases rather than freezing one inside.
//   • zod                         — MUST share ONE instance with the SDK. A
//                                   second bundled copy breaks the SDK's schema
//                                   checks (classic dual-package hazard).
//   • sql.js                      — defensive: unreachable from these entries
//                                   today (the thin client never opens an
//                                   artifact), listed so a future import fails
//                                   loudly at runtime instead of silently
//                                   inlining Emscripten/WASM glue.

import { build } from "esbuild";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const resolveTs = {
  name: "resolve-ts",
  setup(b) {
    b.onResolve({ filter: /\.js$/ }, (args) => {
      if (args.importer && args.path.startsWith(".")) {
        const ts = resolve(dirname(args.importer), args.path.replace(/\.js$/, ".ts"));
        if (existsSync(ts)) return { path: ts };
      }
      return null;
    });
  },
};

const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["sql.js", "@modelcontextprotocol/sdk", "zod"],
  plugins: [resolveTs],
  logLevel: "info",
  // sql.js is CJS; give the ESM bundle a require() for the interop.
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
};

// Output goes to bundle/, NOT dist/: `tsc -b` already emits dist/ from source
// (unbundled, importing @sandboxapis/* that no external consumer can resolve).
// Sharing one directory would make "did typecheck or bundle run last?" decide
// whether the published package works.
//
// The binary. esbuild PRESERVES the shebang already present in src/stdio.ts
// and marks the output executable, so the banner must not add a second one —
// a `#!` on line 2 is a syntax error, not a comment.
await build({
  ...common,
  entryPoints: ["src/stdio.ts"],
  outfile: "bundle/stdio.js",
});

// The programmatic entry, for anyone importing the package rather than running
// it. Untyped on purpose in 0.x — the supported interface is the binary.
await build({
  ...common,
  entryPoints: ["src/index.ts"],
  outfile: "bundle/index.js",
});

console.log("[build] mcp → bundle/stdio.js + bundle/index.js");

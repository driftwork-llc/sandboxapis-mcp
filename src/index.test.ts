import { describe, it, expect } from "vitest";
import { packageName } from "./index.js";

describe("@sandboxapis/mcp", () => {
  it("exposes its package identity", () => {
    expect(packageName).toBe("@sandboxapis/mcp");
  });
});

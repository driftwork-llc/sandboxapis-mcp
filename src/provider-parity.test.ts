// `PROVIDER_PARITY` is a record of CLAIMS, and a claim is only worth storing if
// it can be falsified. These tests hold the declaration itself to that bar; the
// web app's `provider-page.test.ts` holds the rendered page to the harder one
// (the named suite exists, and it serves both hosts).
//
// The split is deliberate. This package cannot read `packages/conformance` —
// it is the thin client, and nothing here may depend on the test tree — so
// file EXISTENCE is checked where the file is reachable. What is checkable
// here is shape: an entry per provider, a non-empty statement, partners that
// are real ids and never the subject, and a `guardedBy` that names a suite
// path rather than free text.

import { describe, expect, it } from "vitest";
import { PROVIDER_IDS, isProviderId } from "./provider-ids.js";
import { PROVIDER_REGISTRY } from "./provider-registry.js";
import { PROVIDER_PARITY, parityClaims } from "./provider-parity.js";

describe("every provider declares what another provider has to agree with", () => {
  it("carries a non-empty claim list for every provider id, and only for provider ids", () => {
    expect(Object.keys(PROVIDER_PARITY).sort()).toEqual([...PROVIDER_IDS].sort());
    for (const id of PROVIDER_IDS) {
      expect(parityClaims(id).length, `${id} declares no parity claim`).toBeGreaterThan(0);
    }
  });

  it("states each claim as a sentence, not a label", () => {
    for (const id of PROVIDER_IDS) {
      for (const claim of parityClaims(id)) {
        // Long enough to be a claim about specific fields; a five-word label
        // ("same data everywhere") is the failure mode this catches.
        expect(claim.statement.trim().length, `${id}: "${claim.statement}"`).toBeGreaterThan(60);
        expect(claim.statement.trim(), `${id} statement ends in a period`).not.toMatch(/\.$/);
      }
    }
  });

  it("names real partners, never itself, never twice", () => {
    for (const id of PROVIDER_IDS) {
      for (const claim of parityClaims(id)) {
        expect(claim.partners.length, `${id}: a claim with no partner is not a parity claim`).toBeGreaterThan(0);
        expect(new Set(claim.partners).size, `${id} repeats a partner`).toBe(claim.partners.length);
        for (const partner of claim.partners) {
          expect(isProviderId(partner), `${id} → ${partner}`).toBe(true);
          expect(partner, `${id} names itself as a parity partner`).not.toBe(id);
        }
      }
    }
  });

  it("points every claim at a conformance suite path", () => {
    for (const id of PROVIDER_IDS) {
      for (const claim of parityClaims(id)) {
        expect(claim.guardedBy, `${id}: ${claim.guardedBy}`).toMatch(/^[a-z0-9-]+\/[a-z0-9-]+\.test\.ts$/);
      }
    }
  });

  it("holds a claim that crosses a category, because most real parity does", () => {
    // The regression this exists for: the catalog's parity data used to be
    // keyed by ProviderCategory, which made a cross-category claim
    // unrepresentable. If every claim in this file ever became same-category
    // again, the structure has been quietly reverted to the shape that hid
    // Sentry's and PagerDuty's whole story.
    const crossing = PROVIDER_IDS.filter((id) =>
      parityClaims(id).some((c) => c.partners.some((p) => PROVIDER_REGISTRY[p].category !== PROVIDER_REGISTRY[id].category)),
    );
    // Every provider outside a multi-tenant category depends on one, and most
    // inside one have a cross-category claim too.
    expect(crossing.length, "no provider makes a cross-category parity claim").toBeGreaterThan(PROVIDER_IDS.length / 2);
  });

  it("is symmetric: if A's page claims agreement with B, B's page claims it back", () => {
    for (const id of PROVIDER_IDS) {
      for (const claim of parityClaims(id)) {
        for (const partner of claim.partners) {
          expect(
            parityClaims(partner).some((c) => c.partners.includes(id)),
            `${partner} does not name ${id} back`,
          ).toBe(true);
        }
      }
    }
  });
});

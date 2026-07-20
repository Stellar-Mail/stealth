import { describe, expect, it } from "vitest";

import { parsePolicyOwnerRouteParam, parsePolicySenderRouteParam } from "../../../src/server/api/route-params";

describe("Policy route parameter parsing", () => {
  it("accepts a valid Stellar owner route parameter", () => {
    const ownerParam = "GCFSP2YH6U36WW5SPLIC2V4OR6UROJWTTWTL7DX2W5Z4I6RAT3FVIYZD";
    const owner = parsePolicyOwnerRouteParam(ownerParam);

    expect(owner).toBe(ownerParam);
  });

  it("accepts a valid Stellar sender route parameter", () => {
    const senderParam = "GD6WNHVVM23RNVR5GBIKEC6SZVWQSPG4ER3G6BWEZBLXIGY4P4XZU3I3";
    const sender = parsePolicySenderRouteParam(senderParam);

    expect(sender).toBe(senderParam);
  });

  it("rejects an invalid owner route parameter", () => {
    expect(() => parsePolicyOwnerRouteParam("not-a-valid-owner")).toThrowError(/Expected a Stellar G-address/);
  });

  it("rejects an invalid sender route parameter", () => {
    expect(() => parsePolicySenderRouteParam("not-a-valid-sender")).toThrowError(/Expected a Stellar G-address/);
  });
});

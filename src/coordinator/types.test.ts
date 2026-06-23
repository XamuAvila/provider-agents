import { describe, it, expect } from "vitest";
import { ROLES, isRole } from "./types.js";

describe("coordinator types", () => {
  it("ROLES lists the three Sakana-style roles in order", () => {
    expect(ROLES).toEqual(["thinker", "worker", "verifier"]);
  });

  it("isRole narrows valid role strings", () => {
    expect(isRole("thinker")).toBe(true);
    expect(isRole("verifier")).toBe(true);
    expect(isRole("aggregator")).toBe(false);
    expect(isRole("")).toBe(false);
  });
});

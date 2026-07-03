import { describe, it, expect } from "vitest";
import { profileToRaw } from "../src/config.js";
import type { ClaudePProfile } from "../src/types.js";

describe("profileToRaw — round-trip fields", () => {
  const base: ClaudePProfile = {
    invocation: "claude-p",
    settings: "creds/readonly.json",
    model: "deepseek-v4-flash",
    provider: "deepseek",
    permissions: "readonly",
    description: "t",
    skills: ["design-patterns-typescript"],
    tags: ["memory", "recall"],
    color: "#22D3EE",
    scripts: ["backup"],
  };

  it("emits skills/tags/color/scripts (regression: they were silently dropped)", () => {
    const raw = profileToRaw(base);
    expect(raw.skills).toEqual(["design-patterns-typescript"]);
    expect(raw.tags).toEqual(["memory", "recall"]);
    expect(raw.color).toBe("#22D3EE");
    expect(raw.scripts).toEqual(["backup"]);
  });

  it("omits derived settings when a permissions preset is present", () => {
    const raw = profileToRaw(base);
    expect(raw.permissions).toBe("readonly");
    expect(raw.settings).toBeUndefined();
  });

  it("keeps an explicit settings path when there is no preset", () => {
    const raw = profileToRaw({ ...base, permissions: undefined, settings: "/abs/custom.json" });
    expect(raw.settings).toBe("/abs/custom.json");
  });

  it("omits empty arrays", () => {
    const raw = profileToRaw({ ...base, skills: [], tags: [], scripts: [] });
    expect(raw.skills).toBeUndefined();
    expect(raw.tags).toBeUndefined();
    expect(raw.scripts).toBeUndefined();
  });
});

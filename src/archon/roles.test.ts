import { describe, it, expect } from "vitest";
import { parseVerdict, fuserPrompt, criticPrompt, verifierPrompt, unitTestPrompt } from "./roles.js";

describe("archon prompts", () => {
  it("parseVerdict reads the last verdict, default REVISE", () => {
    expect(parseVerdict("ok ACCEPT")).toBe("ACCEPT");
    expect(parseVerdict("bad REVISE")).toBe("REVISE");
    expect(parseVerdict("none")).toBe("REVISE");
  });
  it("fuserPrompt lists every candidate", () => {
    const p = fuserPrompt("T", [{ id: "a", text: "C1", fromProfile: "x" }, { id: "b", text: "C2", fromProfile: "y" }]);
    expect(p).toContain("C1"); expect(p).toContain("C2"); expect(p).toContain("T");
  });
  it("criticPrompt asks for strengths and weaknesses", () => {
    const p = criticPrompt("T", [{ id: "a", text: "C1", fromProfile: "x" }]);
    expect(p.toLowerCase()).toContain("strength"); expect(p.toLowerCase()).toContain("weakness");
  });
  it("verifierPrompt demands ACCEPT/REVISE", () => {
    const p = verifierPrompt("T", { id: "a", text: "C", fromProfile: "x" });
    expect(p).toContain("ACCEPT"); expect(p).toContain("REVISE");
  });
  it("unitTestPrompt asks for a fenced test block", () => {
    expect(unitTestPrompt("write add()").toLowerCase()).toContain("unit test");
  });
});

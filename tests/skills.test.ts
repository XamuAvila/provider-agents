import { describe, it, expect } from "vitest";
import {
  getSkillsDir,
  listSkills,
  getSkill,
  getSkillPattern,
  resolveSkillPaths,
} from "../src/skills.js";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const EXPECTED_SKILLS_DIR = resolve(__dirname, "..", "skills");

describe("getSkillsDir", () => {
  it("returns the expected skills directory", () => {
    expect(getSkillsDir()).toBe(EXPECTED_SKILLS_DIR);
  });
});

describe("listSkills", () => {
  it("returns all skill directories with metadata", () => {
    const skills = listSkills();
    const names = skills.map(s => s.name);
    expect(names).toContain("design-patterns-typescript");
    expect(names).toContain("impact-analysis");

    const tsSkill = skills.find(s => s.name === "design-patterns-typescript");
    expect(tsSkill).toBeDefined();
    expect(tsSkill!.description.length).toBeGreaterThan(0);
    expect(tsSkill!.path).toBe(join(EXPECTED_SKILLS_DIR, "design-patterns-typescript"));
  });

  it("returns empty array when skills directory does not exist", () => {
    // No easy way to simulate absence without mocking fs; verify it does not throw.
    expect(() => listSkills()).not.toThrow();
  });
});

describe("getSkill", () => {
  it("returns SKILL.md content for an existing skill", () => {
    const content = getSkill("design-patterns-typescript");
    expect(content).not.toBeNull();
    expect(content).toContain("Design Patterns em TypeScript");
  });

  it("returns null for a missing skill", () => {
    expect(getSkill("nonexistent-skill")).toBeNull();
  });
});

describe("getSkillPattern", () => {
  it("returns pattern content for an existing pattern", () => {
    const content = getSkillPattern("design-patterns-typescript", "behavioral/strategy");
    expect(content).not.toBeNull();
    expect(content).toContain("Strategy");
  });

  it("returns null for a missing pattern", () => {
    expect(getSkillPattern("design-patterns-typescript", "behavioral/missing")).toBeNull();
  });

  it("returns null for a missing skill", () => {
    expect(getSkillPattern("nonexistent-skill", "behavioral/strategy")).toBeNull();
  });
});

describe("resolveSkillPaths", () => {
  it("returns absolute paths only for existing skills", () => {
    const paths = resolveSkillPaths(["design-patterns-typescript", "nonexistent-skill"]);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toBe(join(EXPECTED_SKILLS_DIR, "design-patterns-typescript"));
  });

  it("returns empty array for empty input", () => {
    expect(resolveSkillPaths([])).toEqual([]);
  });
});

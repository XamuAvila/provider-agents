import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createOutputPath,
  readOutput,
  listOutputs,
  cleanupOldOutputs,
} from "../src/output.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "pa-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("createOutputPath", () => {
  it("creates a file path with profile slug and readable timestamp", () => {
    const path = createOutputPath(tempDir, "deepseek");
    expect(path).toMatch(/\d{8}-\d{6}-deepseek\.md$/);
    expect(path.startsWith(tempDir)).toBe(true);
  });

  it("sanitizes profile name in slug", () => {
    const path = createOutputPath(tempDir, "my/weird profile!");
    expect(path).toMatch(/-my-weird-profile-\.md$/);
  });
});

describe("readOutput", () => {
  it("reads an existing output file", () => {
    const filePath = join(tempDir, "test-output.md");
    writeFileSync(filePath, "Hello from agent");
    const content = readOutput(filePath);
    expect(content).toBe("Hello from agent");
  });

  it("returns error message for missing file", () => {
    const content = readOutput(join(tempDir, "missing.md"));
    expect(content).toContain("not found");
  });
});

describe("listOutputs", () => {
  it("lists output files sorted newest first", () => {
    writeFileSync(join(tempDir, "20260601-100000-a.md"), "old");
    writeFileSync(join(tempDir, "20260606-150000-b.md"), "new");
    writeFileSync(join(tempDir, "20260603-120000-c.md"), "mid");

    const outputs = listOutputs(tempDir);
    expect(outputs).toHaveLength(3);
    expect(outputs[0].path).toContain("20260606");
    expect(outputs[2].path).toContain("20260601");
  });

  it("returns empty array for missing directory", () => {
    const outputs = listOutputs("/nonexistent/dir");
    expect(outputs).toEqual([]);
  });
});

describe("cleanupOldOutputs", () => {
  it("does not crash on empty directory", () => {
    expect(() => cleanupOldOutputs(tempDir, 7)).not.toThrow();
  });

  it("does not crash on missing directory", () => {
    expect(() => cleanupOldOutputs("/nonexistent/dir", 7)).not.toThrow();
  });
});

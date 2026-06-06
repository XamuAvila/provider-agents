import {
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { join, basename } from "node:path";
import type { OutputMeta } from "./types.js";

export function createOutputPath(
  outputDir: string,
  profile: string,
): string {
  mkdirSync(outputDir, { recursive: true });

  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  const slug = profile.replace(/[^a-zA-Z0-9-]/g, "-");
  return join(outputDir, `${ts}-${slug}.md`);
}

export function readOutput(filePath: string): string {
  if (!existsSync(filePath)) {
    return `[provider-agents] Output file not found: ${filePath}`;
  }
  return readFileSync(filePath, "utf-8");
}

export function listOutputs(outputDir: string): OutputMeta[] {
  if (!existsSync(outputDir)) {
    return [];
  }

  return readdirSync(outputDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const fullPath = join(outputDir, f);
      const stat = statSync(fullPath);
      const name = basename(f, ".md");
      const parts = name.split("-");
      const tsRaw = parts.slice(0, 2).join("-");
      const profile = parts.slice(2).join("-");

      return {
        path: fullPath,
        profile,
        timestamp: tsRaw,
        sizeBytes: stat.size,
      };
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function cleanupOldOutputs(
  outputDir: string,
  maxAgeDays: number,
): void {
  if (!existsSync(outputDir)) return;

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const files = readdirSync(outputDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const fullPath = join(outputDir, file);
    try {
      const stat = statSync(fullPath);
      if (stat.mtimeMs < cutoff) {
        unlinkSync(fullPath);
      }
    } catch {
      // file disappeared between readdir and stat
    }
  }
}

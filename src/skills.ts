import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SKILLS_DIR = resolve(__dirname, "..", "skills");

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
}

export function getSkillsDir(): string {
  return SKILLS_DIR;
}

export function listSkills(): SkillInfo[] {
  if (!existsSync(SKILLS_DIR)) return [];
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const skillPath = join(SKILLS_DIR, d.name);
      const skillMd = join(skillPath, "SKILL.md");
      let description = "";
      if (existsSync(skillMd)) {
        const content = readFileSync(skillMd, "utf-8");
        const match = content.match(/^description:\s*(.+)$/m);
        description = match?.[1]?.replace(/^["']|["']$/g, "") ?? "";
      }
      return { name: d.name, description, path: skillPath };
    });
}

export function getSkill(name: string): string | null {
  const skillMd = join(SKILLS_DIR, name, "SKILL.md");
  if (!existsSync(skillMd)) return null;
  return readFileSync(skillMd, "utf-8");
}

export function getSkillPattern(skillName: string, patternPath: string): string | null {
  for (const subdir of ["patterns", "references", "chapters"]) {
    const fullPath = join(SKILLS_DIR, skillName, subdir, `${patternPath}.md`);
    if (existsSync(fullPath)) return readFileSync(fullPath, "utf-8");
  }
  return null;
}

export function resolveSkillPaths(skillNames: string[]): string[] {
  return skillNames.map(name => join(SKILLS_DIR, name)).filter(p => existsSync(p));
}

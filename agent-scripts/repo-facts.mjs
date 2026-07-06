#!/usr/bin/env node
// description: report repository stack, workspace, package manager, and declared verification commands without reading secrets
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = resolve(process.argv[2] ?? process.cwd());
const files = ["package.json", "pnpm-workspace.yaml", "bun.lock", "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "pyproject.toml", "go.mod", "Cargo.toml", "global.json", "*.sln"];
console.log(`root: ${root}`);
console.log(`name: ${basename(root)}`);
console.log(`markers: ${files.filter((file) => !file.includes("*") && existsSync(resolve(root, file))).join(", ") || "none"}`);

const packagePath = resolve(root, "package.json");
if (existsSync(packagePath)) {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  console.log(`package-manager: ${pkg.packageManager ?? (existsSync(resolve(root, "pnpm-lock.yaml")) ? "pnpm" : existsSync(resolve(root, "bun.lock")) ? "bun" : "npm")}`);
  const scripts = pkg.scripts ?? {};
  const verification = Object.keys(scripts).filter((name) => /^(test|check|typecheck|lint|build)(:|$)/.test(name));
  console.log(`verification-scripts: ${verification.join(", ") || "none"}`);
}

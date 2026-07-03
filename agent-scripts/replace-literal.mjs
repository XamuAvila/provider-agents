#!/usr/bin/env node
// description: replace a LITERAL substring in a file (no regex), like VSCode find/replace
//
// usage: replace-literal.mjs <file> <search> <replace> [--first] [--dry-run]
//   --first    replace only the first occurrence (default: all)
//   --dry-run  report the match count without writing
//
// Literal by construction: uses String.split(search).join(replace), so no regex
// metacharacters, escaping, or surprises. Exit 0 on success (even 0 matches),
// 2 on bad usage, 1 on read/write error.
import { readFileSync, writeFileSync } from "node:fs";

const [, , file, search, replace, ...flags] = process.argv;

if (file === undefined || search === undefined || replace === undefined) {
  console.error("usage: replace-literal.mjs <file> <search> <replace> [--first] [--dry-run]");
  process.exit(2);
}
if (search === "") {
  console.error("error: the search string must not be empty");
  process.exit(2);
}

const dryRun = flags.includes("--dry-run");
const firstOnly = flags.includes("--first");

let content;
try {
  content = readFileSync(file, "utf-8");
} catch (e) {
  console.error(`error: cannot read ${file}: ${e.message}`);
  process.exit(1);
}

let count;
let out;
if (firstOnly) {
  const idx = content.indexOf(search);
  count = idx === -1 ? 0 : 1;
  out = idx === -1 ? content : content.slice(0, idx) + replace + content.slice(idx + search.length);
} else {
  const parts = content.split(search);
  count = parts.length - 1;
  out = parts.join(replace);
}

console.log(`file:    ${file}`);
console.log(`matches: ${count}${firstOnly ? " (first-only mode)" : ""}`);

if (count > 0 && !dryRun) {
  try {
    writeFileSync(file, out, "utf-8");
  } catch (e) {
    console.error(`error: cannot write ${file}: ${e.message}`);
    process.exit(1);
  }
  console.log("written: yes");
} else {
  console.log(`written: no${dryRun ? " (dry-run)" : count === 0 ? " (no matches)" : ""}`);
}

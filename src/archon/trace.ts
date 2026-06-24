import type { CoordinationResult, Trace } from "./types.js";

// Tagging is structural, not keyword-loose: each regex must look like CODE, not
// English prose, to avoid mis-routing (e.g. "select X from Y" in a sentence must
// NOT tag SQL). Consumed by the Task 11 assembler + the HumanEval eval router.
const RULES: { tag: string; re: RegExp }[] = [
  { tag: "python", re: /\bdef\s+\w+\s*\(|\bfrom\s+[\w.]+\s+import\b|\bimport\s+(os|sys|re|json|math|typing|numpy|np|pandas|pd|collections|itertools|functools|asyncio|dataclasses)\b|\bpython\b|\.py\b|\bprint\s*\(\s*['"f]/i },
  // interface PascalCase check is case-sensitive (no /i) to avoid matching "interface design".
  // The /i variants cover keyword and file-extension detection.
  { tag: "typescript", re: /\btypescript\b|\.tsx?\b|\bexport\s+(function|const|class|interface|type|default|async)\b/i },
  { tag: "typescript", re: /\binterface\s+[A-Z]\w*/ },
  { tag: "javascript", re: /\bjavascript\b|\.jsx?\b|\bfunction\s+\w+\s*\([^)]*\)\s*\{|\bconst\s+\w+\s*=|\b(let|var)\s+\w+\s*=/i },
  { tag: "csharp", re: /\bc#|\bcsharp\b|\.cs\b|\bpublic\s+(class|static|void|async)\b|\busing\s+System\b/i },
  // namespace PascalCase check is case-sensitive (no /i): under /i, [A-Z] matches lowercase
  // too, so "namespace of discourse" would mis-tag as csharp (same bug as the interface split).
  { tag: "csharp", re: /\bnamespace\s+[A-Z]\w*/ },
  { tag: "sql", re: /\bsql\b|\bselect\b[\s\S]{0,200}\bfrom\b[\s\S]{0,120}\b(where|join|group\s+by|order\s+by|having|limit)\b|\binsert\s+into\b[\s\S]{0,120}\bvalues\b|\bcreate\s+table\b|\bupdate\b[\s\S]{0,80}\bset\b/i },
  { tag: "security", re: /\bsecurity\b|\bvulnerab|\bowasp\b|\binjection\b|\bxss\b|\bcsrf\b|\bauth(entication|orization)\b/i },
  { tag: "reasoning", re: /\bwhy\b|\bexplain\b|\breason\b|\bprove\b|\banaly[sz]e\b|\broot\s+cause\b|\brca\b|\bstep[- ]by[- ]step\b/i },
];
const CODE_TAGS = new Set(["python", "typescript", "javascript", "csharp", "sql"]);
const CODE_INTENT = /\bcode\b|\bimplement\b|\bwrite a function\b|\balgorithm\b|\brefactor\b|\bfix the bugs?\b|\bunit test\b|\bcompile\b/i;

/** Derive routing tags. Emits a language tag + "code" for code-ish tasks,
 *  "reasoning" for reasoning, "security" where relevant; ["general"] if nothing
 *  matches. Regexes are structural to avoid prose false positives. Pure. */
export function deriveTags(task: string): string[] {
  const matched: string[] = [];
  for (const { tag, re } of RULES) if (re.test(task)) matched.push(tag);
  // A tag can match via more than one RULES entry (interface/namespace splits) — dedupe.
  const unique = [...new Set(matched)];
  // TypeScript is a superset of JavaScript; if both fire, keep only typescript.
  const langs = unique.includes("typescript") ? unique.filter((t) => t !== "javascript") : unique;
  const out = [...langs];
  if (out.some((t) => CODE_TAGS.has(t)) && !out.includes("code")) out.push("code");
  if (!out.includes("code") && CODE_INTENT.test(task)) out.push("code");
  return out.length ? out : ["general"];
}

/** Build a persistable Trace from a coordination/pipeline result. Pure — copies
 *  the turns array so the returned Trace is not aliased to the caller's. */
export function buildTrace(task: string, result: CoordinationResult, createdAt: string): Trace {
  return {
    id: result.traceId,
    task,
    taskTags: deriveTags(task),
    turns: [...result.turns],
    accepted: result.accepted,
    createdAt,
  };
}

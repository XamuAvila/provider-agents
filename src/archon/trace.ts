import type { CoordinationResult, Trace } from "./types.js";

const RULES: { tag: string; re: RegExp }[] = [
  { tag: "python", re: /\bdef\s+\w+\s*\(|\bimport\s+\w+|\bpython\b|\.py\b|\bprint\s*\(/i },
  { tag: "typescript", re: /\btypescript\b|\binterface\s+\w+|\.tsx?\b|\bexport\s+(function|const|class|interface|type)\b/i },
  { tag: "javascript", re: /\bjavascript\b|\.jsx?\b|\bfunction\s+\w+\s*\(|\bconst\s+\w+\s*=/i },
  { tag: "csharp", re: /\bc#|\bcsharp\b|\.cs\b|\bpublic\s+(class|static|void)\b|\bnamespace\s+\w+/i },
  { tag: "sql", re: /\bsql\b|\bselect\s+[\s\S]+\bfrom\b|\binsert\s+into\b|\bcreate\s+table\b/i },
  { tag: "security", re: /\bsecurity\b|\bvulnerab|\bowasp\b|\binjection\b|\bxss\b|\bauth(entication|orization)?\b/i },
  { tag: "reasoning", re: /\bwhy\b|\bexplain\b|\breason\b|\bprove\b|\banaly[sz]e\b|\broot cause\b|\brca\b|\bstep[- ]by[- ]step\b/i },
];
const CODE_TAGS = new Set(["python", "typescript", "javascript", "csharp", "sql"]);
const CODE_INTENT = /\bcode\b|\bimplement\b|\bfunction\b|\balgorithm\b|\brefactor\b|\bfix the bug\b|\bunit test\b/i;

/** Derive routing tags for a task. Emits language tag(s) + "code" for code-ish
 *  tasks, "reasoning" for reasoning, "security" where relevant; ["general"] if
 *  nothing matches. Consumed by the Task 11 assembler and the HumanEval eval. */
export function deriveTags(task: string): string[] {
  const tags: string[] = [];
  for (const { tag, re } of RULES) if (re.test(task)) tags.push(tag);
  if (tags.some((t) => CODE_TAGS.has(t)) && !tags.includes("code")) tags.push("code");
  if (!tags.includes("code") && CODE_INTENT.test(task)) tags.push("code");
  return tags.length ? tags : ["general"];
}

/** Build a persistable Trace from a coordination/pipeline result. Pure. */
export function buildTrace(task: string, result: CoordinationResult, createdAt: string): Trace {
  return {
    id: result.traceId,
    task,
    taskTags: deriveTags(task),
    turns: result.turns,
    accepted: result.accepted,
    createdAt,
  };
}

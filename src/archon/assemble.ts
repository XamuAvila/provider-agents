import type { ArchitectureSpec, Candidate, EngineDeps } from "./types.js";
import { generate } from "./layers/generator.js";
import { fuse } from "./layers/fuser.js";
import { critique } from "./layers/critic.js";
import { rank } from "./layers/ranker.js";
import { verifyBest } from "./layers/verifier.js";
import { unitTestRank } from "./layers/unittest.js";

/** Profile lists supplied per role to the assembler. */
export interface Pools {
  generators: string[];
  fuser: string;
  critic: string;
  ranker: string;
  verifiers: string[];
  tester: string;
}

const isCode = (tags: string[]) =>
  tags.some((t) => ["code", "python", "typescript", "javascript", "csharp", "sql"].includes(t));
const isReasoning = (tags: string[]) => tags.includes("reasoning");

/**
 * Archon's empirical best-practice pipeline per task category:
 * - code → generator ensemble then EXECUTION-GROUNDED selection (unitTestRank).
 *   No fuser: with executable code, picking the candidate that passes the most
 *   generated tests (best-of-N) beats synthesizing one answer that might break
 *   (Archon's biggest lever, +56% Pass@1).
 * - reasoning → generator → fuser → critic → ranker → multi-verifier vote.
 * - general/instruction → generator → critic → ranker → fuser.
 */
export function bestPracticeSpec(tags: string[]): ArchitectureSpec {
  if (isCode(tags)) {
    return { name: "code", layers: [{ kind: "generator", samples: 1 }, { kind: "unittest" }] };
  }
  if (isReasoning(tags)) {
    return {
      name: "reasoning",
      layers: [
        { kind: "generator", samples: 2 },
        { kind: "fuser" },
        { kind: "critic" },
        { kind: "ranker", topK: 3 },
        { kind: "verifier" },
      ],
    };
  }
  return {
    name: "general",
    layers: [
      { kind: "generator", samples: 1 },
      { kind: "critic" },
      { kind: "ranker", topK: 3 },
      { kind: "fuser" },
    ],
  };
}

/**
 * Run an ArchitectureSpec's layers in order over the model pool, threading the
 * candidate list through each layer. `pools` supplies the profile list per role;
 * a layer may override generator profiles/samples via its LayerConfig. Returns
 * the top candidate's text as the answer plus the full candidate list.
 */
export async function assemble(
  task: string,
  tags: string[],
  spec: ArchitectureSpec,
  deps: EngineDeps,
  pools: Pools,
  lang = "python",
): Promise<{ answer: string; candidates: Candidate[] }> {
  let candidates: Candidate[] = [];
  for (const layer of spec.layers) {
    switch (layer.kind) {
      case "generator":
        candidates = await generate(task, layer.profiles ?? pools.generators, layer.samples ?? 1, deps);
        break;
      case "fuser":
        candidates = [await fuse(task, candidates, pools.fuser, deps)];
        break;
      case "critic":
        candidates = await critique(task, candidates, pools.critic, deps);
        break;
      case "ranker":
        candidates = await rank(task, candidates, pools.ranker, layer.topK ?? 3, deps);
        break;
      case "verifier":
        candidates = [await verifyBest(task, candidates, pools.verifiers, deps)];
        break;
      case "unittest":
        candidates = await unitTestRank(task, candidates, pools.tester, lang, deps);
        break;
    }
    if (candidates.length === 0) break;
  }
  return { answer: candidates[0]?.text ?? "", candidates };
}

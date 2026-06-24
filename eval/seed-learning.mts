// One-off: seed the curated architectural lesson from the 2026-06-23 eval cycle
// into the Obsidian vault. Run AFTER a benchmark finishes (avoids racing the
// harness on Learnings/_index.md). Usage: node_modules/.bin/tsx eval/seed-learning.mts
import { resolveVaultDir } from "../src/archon/memory.js";
import { writeLearning, upsertLearningIndex } from "../src/archon/learnings.js";
import type { Learning } from "../src/archon/types.js";

const learning: Learning = {
  id: "humaneval-selection-self-tests-not-ground-truth",
  title: "Execution-grounded selection must not trust self-generated tests as ground truth",
  description:
    "Archon lost HumanEval/10 to a single model because binary all-or-nothing scoring trusted a wrong self-generated test; fix = passed-test-count + example-anchored tests.",
  tags: ["archon", "selection", "unittest", "humaneval", "architecture"],
  severity: "high",
  source: "humaneval",
  problemId: "HumanEval/10",
  whatHappened:
    "In the N=20 run the single baseline (gpt-oss) solved HumanEval/10 (make_palindrome) but the Archon ensemble did not — archon 19/20 < baseline 20/20 (NOT MET).",
  rootCause:
    "unitTestRank scored candidates BINARY (pytest exit 0 = all pass). One wrong/over-strict self-generated assertion zeroed a correct candidate, while a wrong candidate that satisfied the bad test outranked it. Self-generated tests are not ground truth.",
  lesson:
    "Execution-grounded best-of-N is only as good as the tests it ranks against; binary all-or-nothing amplifies a single bad assertion into a wrong selection.",
  howToApply:
    "(1) Score by passed-test COUNT, not all-or-nothing. (2) Anchor generated tests on the task's concrete examples (docstring >>> / stated I/O); forbid invented expected outputs. (3) One pytest function per case so partial correctness is measurable. (4) Break ties toward the strongest generator (stable sort, anchor first in pool).",
  createdAt: new Date().toISOString(),
};

const vaultDir = resolveVaultDir();
const path = writeLearning(learning, vaultDir);
const idx = upsertLearningIndex(learning, vaultDir);
console.log("seeded learning:", path);
console.log("index:", idx);

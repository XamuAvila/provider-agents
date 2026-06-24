import type { Candidate, EngineDeps } from "../types.js";

const GEN_BRIEF = "Produce your single best, complete, independent solution to the task.";

export async function generate(
  task: string, profiles: string[], samples: number, deps: EngineDeps,
): Promise<Candidate[]> {
  const jobs: Promise<Candidate | null>[] = [];
  for (const profile of profiles) {
    for (let s = 0; s < samples; s++) {
      const id = `${profile}#${s}`;
      const outputPath = deps.outputPathFor(id);
      jobs.push(
        deps.spawn(profile, `${GEN_BRIEF}\n\n## Task\n${task}`, outputPath).then((r) => {
          const text = r.status === "ok" ? deps.readOutput(r.outputPath).trim() : "";
          return text ? { id, text, fromProfile: profile } : null;
        }),
      );
    }
  }
  const settled = await Promise.all(jobs);
  return settled.filter((c): c is Candidate => c !== null);
}

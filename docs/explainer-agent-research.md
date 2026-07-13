# Explainer Agent Research

Fetched on 2026-07-06. These notes capture the interaction patterns used to
design the `explainer` profile.

## Findings

- Ground explanations in explicit repository context and show the references
  used. GitHub Copilot's Ask mode is optimized for codebase understanding and
  exposes the files/references used in the answer.
- Keep discovery read-only and separate from implementation. GitHub distinguishes
  Ask mode for understanding from Agent mode for autonomous changes.
- Retrieve relevant code semantically rather than relying on whichever file is
  currently open. Sourcegraph Cody describes codebase context as the mechanism
  for finding relevant repository content for a request.
- Prefer conversational, navigable documentation over a one-shot summary.
  DeepWiki's core interaction is up-to-date repository documentation that users
  can ask follow-up questions about.
- Use text-defined diagrams selectively. Mermaid supports flowcharts, sequence,
  class, state, architecture and other diagram types that remain editable as text.

## Resulting profile behavior

The agent uses progressive disclosure: short mental model, component map, one
concrete end-to-end walkthrough, invariants, glossary, and a recommended reading
path. Every behavioral claim requires `file:line`. Mermaid/HTML is optional and
reserved for flows whose visual structure is materially easier to understand.

## Sources

- GitHub Copilot Chat in IDE:
  https://docs.github.com/en/copilot/how-tos/chat-with-copilot/chat-in-ide
- Sourcegraph Cody context:
  https://sourcegraph.com/docs/cody/core-concepts/context
- DeepWiki:
  https://deepwiki.com/
- Mermaid documentation:
  https://mermaid.js.org/intro/

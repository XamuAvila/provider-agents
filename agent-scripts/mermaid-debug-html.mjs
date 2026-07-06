#!/usr/bin/env node
// description: render a Mermaid source file into a standalone debugging HTML under /tmp
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const [, , sourceArg, outputArg, titleArg] = process.argv;
if (!sourceArg) {
  console.error("usage: mermaid-debug-html.mjs <source.mmd> [output.html] [title]");
  process.exit(2);
}

const source = resolve(sourceArg);
const output = resolve(outputArg ?? `/tmp/provider-agents/debug-flow-${Date.now()}.html`);
const tmpRoot = "/tmp/";
if (!output.startsWith(tmpRoot) || !output.endsWith(".html")) {
  console.error("error: output must be an .html file under /tmp");
  process.exit(2);
}

let diagram;
try {
  diagram = readFileSync(source, "utf8");
} catch (error) {
  console.error(`error: cannot read ${source}: ${error.message}`);
  process.exit(1);
}
if (!diagram.trim()) {
  console.error("error: Mermaid source is empty");
  process.exit(2);
}

const escapeHtml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
const title = titleArg ?? basename(source, ".mmd").replaceAll("-", " ");
const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --ink: #172121; --paper: #f4f1e8; --accent: #d45b35; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at top left, #fff9e8, var(--paper) 55%); color: var(--ink); font-family: Georgia, serif; }
    header { padding: 28px 5vw 12px; border-bottom: 3px solid var(--ink); }
    h1 { margin: 0; font-size: clamp(1.5rem, 4vw, 3rem); letter-spacing: -0.03em; }
    main { padding: 28px 4vw 48px; overflow: auto; }
    .diagram { min-width: max-content; padding: 24px; background: rgba(255,255,255,.72); border: 1px solid #b9b3a5; box-shadow: 8px 8px 0 var(--accent); }
    .hint { margin-top: 22px; font: 14px/1.5 ui-monospace, monospace; color: #4f5b56; }
  </style>
</head>
<body>
  <header><h1>${escapeHtml(title)}</h1></header>
  <main>
    <pre class="mermaid diagram">${escapeHtml(diagram)}</pre>
    <p class="hint">Arquivo gerado para investigação. A fonte Mermaid permanece separada para edição.</p>
  </main>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "strict", flowchart: { curve: "basis", htmlLabels: false } });
  </script>
</body>
</html>
`;

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html, "utf8");
console.log(output);

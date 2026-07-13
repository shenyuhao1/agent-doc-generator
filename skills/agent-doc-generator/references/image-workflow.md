# Image Workflow

Use this reference when a development document needs screenshots, existing images, precise diagrams, or Codex-generated explanatory visuals.

## Pipeline

1. Write `image-plan.json`.
2. Generate or render any explanatory assets into the workspace.
3. Run `scripts/prepare-images.mjs`.
4. Copy `scripts/doc-image-helpers.cjs` beside `gen_doc.js`.
5. Load the generated manifest from `gen_doc.js`.
6. Insert images by stable ID.

The preparation script never invokes image generation itself. Codex generates the bitmap first, copies it into the workspace, and records it as `source: "generated"`. This keeps tool execution separate from deterministic document generation.

## Source Choice

| Need | Source | Reason |
|---|---|---|
| Actual product state | `screenshot` | Preserves the real UI and data state |
| Existing chart, logo, or screenshot | `file` | Reuses the authoritative asset |
| Exact architecture or sequence labels | HTML/CSS/SVG/Mermaid plus `screenshot` | Keeps text and structure deterministic |
| Conceptual explanation or educational illustration | `generated` | Useful when interpretation matters more than exact UI |

Do not use generated images to prove that a feature works. Use a real screenshot for that claim.

## Image Plan Schema

```json
{
  "baseUrl": "http://127.0.0.1:3000",
  "outputDir": "doc-assets",
  "manifest": "images.json",
  "browserChannel": "chrome",
  "viewport": { "width": 1440, "height": 900 },
  "images": [
    {
      "id": "dashboard",
      "source": "screenshot",
      "url": "/dashboard",
      "file": "dashboard.png",
      "waitForSelector": "main",
      "fullPage": true,
      "caption": "Dashboard after the import completes",
      "alt": "Completed dashboard view",
      "required": true
    },
    {
      "id": "architecture",
      "source": "file",
      "path": "diagrams/architecture.png",
      "file": "architecture.png",
      "caption": "Request flow through the application",
      "alt": "Application request-flow diagram",
      "required": true
    },
    {
      "id": "concept",
      "source": "generated",
      "path": "generated/concept.png",
      "file": "concept.png",
      "caption": "Conceptual view of the document pipeline",
      "alt": "Conceptual document-pipeline illustration",
      "required": false
    }
  ]
}
```

Paths in `path` are relative to the plan. Paths in the generated manifest are relative to the manifest.

## Screenshot Fields

- `url`: HTTP(S), `file://`, a path resolved against `baseUrl`, or a local HTML path.
- `selector`: capture one element instead of the page.
- `waitForSelector`: wait until an element becomes visible.
- `waitUntil`: `commit`, `domcontentloaded`, `load`, or `networkidle`.
- `delayMs`: optional delay after readiness.
- `timeoutMs`: navigation timeout.
- `fullPage`: capture the entire page when no selector is supplied.
- `viewport`: per-image viewport override.

## Playwright Resolution

The script searches in this order:

1. `PLAYWRIGHT_PATH` environment variable.
2. Project or global `playwright` package.
3. Project or global `playwright-core` package.

Use `browserExecutable` in the plan for a specific Chromium executable, or `browserChannel` for an installed Chrome/Edge channel.

## Codex Image Generation

Use the built-in `imagegen` tool for conceptual bitmap visuals. Prefer `infographic-diagram`, `scientific-educational`, or `productivity-visual` prompts. Keep exact text out of the generated bitmap; add labels and captions in DOCX or render a precise diagram with HTML/CSS/SVG.

After generation:

1. Inspect the result.
2. Copy the selected image from `$CODEX_HOME/generated_images/...` into the document workspace.
3. Add it to the plan with `source: "generated"`.
4. Run `prepare-images.mjs` so dimensions and paths enter the manifest.

## Encoding Safety

- Keep PNG/JPEG bytes binary from disk to `ImageRun`.
- Never convert image bytes with `.toString("utf8")`.
- Never embed Base64 image data in `images.json`.
- Read and write plan, manifest, caption, and generator files as UTF-8.
- Test with a Chinese caption and a PNG after modifying the pipeline.

## Generator Integration

```javascript
const path = require("node:path");
const { createImageHelpers } = require("./doc-image-helpers.cjs");

const { imageBlock } = createImageHelpers({
  manifestPath: path.resolve(__dirname, "doc-assets/images.json"),
  maxWidth: 620,
  maxHeight: 430,
});
```

Insert images with stable IDs:

```javascript
children.push(...imageBlock("dashboard", { required: true }));
children.push(...imageBlock("concept"));
```

Required images stop generation when missing. Optional images become labeled placeholders.

## Visual Validation

After generating the DOCX, run the DOCX validator, convert it to PDF when LibreOffice is available, render the pages, and check sharpness, captions, page breaks, and overflow.

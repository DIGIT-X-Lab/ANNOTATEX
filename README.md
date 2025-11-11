# AnnotateX

> Transform free-form text into structured, reviewable intelligence.

AnnotateX is a fully on-prem annotation workspace that combines a precision text editor, schema workbench, and interactive knowledge graph. Everything you tag stays in sync across the editor, JSON inspector, exports, and graph view—ready for downstream NLP, analytics, or LLM tuning.

![AnnotateX](https://img.shields.io/badge/version-1.0.0-00B8D9)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-ready-blue)

---

## Product Highlights

- **Multi-Document Workspace** – load an entire folder (txt/pdf), navigate with arrow buttons or `⌥ ←/→`, and see progress + status for each asset.
- **Fluid Text Annotation** – select spans directly in the editor to summon a floating label palette. Badges display label, sentiment, and metadata inline.
- **Custom Label Properties** – define any number of per-label fields (e.g., lesion location, severity) and edit them inline or via the workbench.
- **Schema-as-a-Feature** – define labels, colors, and optional metadata requirements (sentiment, confidence, notes). Schema changes apply instantly across the UI.
- **Annotation Workbench** – inspect spans, update metadata, review linked relationships, and bulk-clear edges without leaving the page.
- **Interactive Graph** – every annotation becomes a draggable node. Draw edges to propose relationships, confirm direction + type in a dialog, and delete edges with a keystroke.
- **Live JSON + Export** – JSON view mirrors current state; export JSON/CSV per document with RFC‑4180-safe CSV quoting. (Multi-document export planned.)
- **On-Prem Ready** – stateless Vite/React front-end deploys behind your firewall via Docker, Docker Compose, or any static host + API stack.

---

## Getting Started

### Prerequisites

- Node.js 18+ (use [nvm](https://github.com/nvm-sh/nvm) for convenience)
- npm 9+

### Local Development

```bash
git clone <repo>
cd text-x-struct
npm install
npm run dev
```

Visit `http://localhost:5173` to use AnnotateX with hot reloading.

### Production Build

```bash
npm run build
npm run preview   # optional: serves the dist bundle at http://localhost:4173
```

### Branding Notes

- AnnotateX ships with the DIGITX / LMU Radiology theme (Quipu Orange `#FC683F`). Adjust the CSS custom properties in `src/index.css` to retheme.
- Drop a hero image at `public/brand-banner.jpg` (PNG/JPG/WebP) to replace the default gradient banner that sits under the header.

### Docker / Compose

```bash
docker-compose up -d
# or
docker build -t annotatex .
docker run --rm -p 8080:80 annotatex
```

The default Nginx config (see `nginx.conf`) serves the optimized build at `http://localhost:8080`.

---

## Application Tour

| Surface | Purpose | Key Shortcuts / Tips |
| --- | --- | --- |
| **Document Toolbar** | Load folders, jump between docs, see format badges + progress bar | Use `⌥ + ←/→` to move between documents without leaving the keyboard |
| **Editor** | Select spans to label, toggle link mode, inline sentiment picker | Click an annotation to focus; `Link Annotations` button toggles relationship mode |
| **JSON Viewer** | Read-only, auto-updating JSON representing text, annotations, metadata, relationships | Copy/paste for downstream tooling |
| **Schema Tab** | Manage labels, colors, and custom properties | Add/remove any number of per-label properties (location, severity, etc.) |
| **Workbench Tab** | Inspect selected annotation, edit custom properties, remove annotations/relations | Hover relationships list to delete edges |
| **Graph Tab** | Drag nodes, draw relationships, confirm direction/type, delete edges | Select edge + `Delete` key to remove |
| **Export Button** | Bottom-left floating action button | Export the active doc or the entire dataset (JSON/CSV) |

---

## Architecture Overview

- **Frontend stack**: Vite + React 18 + TypeScript, shadcn/ui + Tailwind for components, React Flow for graph interactions.
- **State shape**: page-level `Index.tsx` owns text, annotations, relationships, schema, and selected annotation. Components receive callbacks to ensure every surface stays synchronized.
- **Annotation model**: includes `labelId`, `metadata` (sentiment/confidence/notes), and relationships referencing annotation IDs.
- **Exports**: JSON mirrors in-memory state; CSV includes columns for text span, label, sentiment, confidence, notes (safe quoting for commas/newlines).

See `docs/ANNOTATEX.md` for a deeper dive into data structures, component responsibilities, and future roadmap.

---

## Deployment Notes

AnnotateX is designed for air-gapped or on-prem environments:

- Static assets (Vite build) can be served by any CDN, Nginx, or reverse proxy.
- For containerized environments, use `Dockerfile` + `docker-compose.yml`, or integrate with your orchestrator of choice (Kubernetes, Nomad, etc.).
- TLS, authentication, and backend persistence are intentionally left to the hosting environment so you can align with your internal security posture.

Refer to **[DEPLOYMENT.md](./DEPLOYMENT.md)** for steps covering Docker, reverse proxies, SSL, and production hardening.

---

## Roadmap (Shortlist)

1. **Multi-document Workspace** – manage corpora with keyboard navigation, document drawer, and per-document exports.
2. **Command Palette** – global `⌘K` actions for jumping between annotations, labels, and documents.
3. **Schema Templates** – curated ontologies for contracts, biomedical, news, etc.
4. **Validation Rules** – enforce ontology constraints (e.g., each Organization must be `located_in` a Location) with inline warnings.
5. **AI Suggestions** – optional assist mode for proposed spans, sentiments, and relationships.

---

## Contributing & Support

- **Lint**: `npm run lint`
- **Type-check**: `tsc --noEmit`
- **Testing**: Add your preferred framework (Playwright, Vitest) as needed—the UI is already structured for component testing.

For feature requests or deployment questions, open an issue with the AnnotateX maintainers.

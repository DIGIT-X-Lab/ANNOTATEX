<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./public/assets/Annotatex-dark-mode.png" />
    <img alt="AnnotateX" src="./public/assets/Annotatex-light-mode.png" />
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-00b8d9?style=flat-square&labelColor=111827&color=00b8d9" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-34d399?style=flat-square&labelColor=111827" alt="License" />
  <img src="https://img.shields.io/badge/deploy-docker-8b5cf6?style=flat-square&labelColor=111827" alt="Docker" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-7ff4ff?style=flat-square&logo=react&logoColor=111827" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-d8e6ff?style=flat-square&logo=typescript&logoColor=3178C6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-d0f5ff?style=flat-square&logo=tailwindcss&logoColor=38BDF8" alt="Tailwind" />
  <img src="https://img.shields.io/badge/shadcn/ui-f1d4ff?style=flat-square&logo=radix-ui&logoColor=6E59A5" alt="shadcn" />
  <img src="https://img.shields.io/badge/Vite-ffe0cc?style=flat-square&logo=vite&logoColor=FF7A18" alt="Vite" />
  <img src="https://img.shields.io/badge/React%20Flow-cff8e6?style=flat-square&logo=react&logoColor=0A0A0A" alt="React Flow" />
</p>

AnnotateX is a fully on-prem annotation workspace that combines a precision text editor, schema workbench, and interactive knowledge graph. Everything you tag stays in sync across the editor, JSON inspector, exports, and graph view—ready for downstream NLP, analytics, or LLM tuning.

---

## Product Highlights

- **Multi-Document Workspace** – load an entire folder (txt/pdf), navigate with arrow buttons or `⌥ ←/→`, and see progress + status for each asset.
- **Fluid Text Annotation** – select spans directly in the editor to summon a floating label palette. Badges display label, sentiment, and metadata inline.
- **Custom Label Properties** – define any number of per-label fields (e.g., lesion location, severity) and edit them inline or via the workbench.
- **Schema-as-a-Feature** – define labels, colors, and optional metadata requirements. Schema changes apply instantly across the UI.
- **Annotation Workbench** – inspect spans, update metadata, review linked relationships, and bulk-clear edges without leaving the page.
- **Interactive Graph** – every annotation becomes a draggable node. Draw edges to propose relationships, confirm direction + type in a dialog, and delete edges with a keystroke.
- **Live JSON + Export** – JSON view mirrors current state; export JSON/CSV per document with RFC‑4180-safe CSV quoting.
- **On-Prem Ready** – stateless Vite/React front-end deploys behind your firewall via Docker, Docker Compose, or any static host + API stack.

---

## Getting Started

### Prerequisites

- Node.js 18+ (use [nvm](https://github.com/nvm-sh/nvm) for convenience)
- npm 9+

### Local Development

```bash
git clone <repo>
cd annotatex
npm install
npm run dev
```

Visit `http://localhost:5173` to use AnnotateX with hot reloading.

### Production Build

```bash
npm run build
npm run preview   # optional: serves the dist bundle at http://localhost:4173
```

### Docker / Compose

```bash
docker-compose up -d
# or
docker build -t annotatex .
docker run --rm -p 8080:80 annotatex
```

The default Nginx config (see `nginx.conf`) serves the optimized build at `http://localhost:8080`.

---

## Example Workflow

A sample chest X-ray report is preloaded so you can see how AnnotateX validates structured AI output:

1. Select spans like “Patchy airspace opacities in the right mid and lower lung…”
2. Assign schema labels (Cardiomegaly, Pleural effusion, Pneumothorax, Consolidation, Pneumonia) and fill in their properties (presence, severity).
3. Live JSON mirrors each edit; export the reviewer-approved structure for downstream systems.

---

## Architecture Overview

- **Frontend stack**: Vite + React 18 + TypeScript, shadcn/ui + Tailwind for components, React Flow for graph interactions.
- **State shape**: page-level `Index.tsx` owns text, annotations, relationships, schema, and selected annotation.
- **Annotation model**: includes `labelId`, `metadata`, and relationships referencing annotation IDs.
- **Exports**: JSON mirrors in-memory state; CSV includes columns for text span, label, sentiment, confidence, notes.

---

## Documentation

- Product & architecture guide: `docs/ANNOTATEX.md`
- Deployment: `DEPLOYMENT.md`

---

## Branding Notes

- Place GitHub banners at `public/assets/github-banner-light.png` and `public/assets/github-banner-dark.png`.
- Swap `public/favicon.svg` with your lab mark for browser tabs.
- Drop `public/brand-banner.jpg` to replace the in-app header hero.

## License

MIT

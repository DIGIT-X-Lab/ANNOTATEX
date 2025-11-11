# AnnotateX Technical Guide

This document captures the current architecture, feature set, and operational guidance for the on-prem AnnotateX workspace. It is intended for engineers who deploy, extend, or integrate the app into proprietary annotation pipelines.

---

## 1. High-Level Architecture

| Layer | Technology | Notes |
| --- | --- | --- |
| UI runtime | React 18 + TypeScript (Vite) | SPA served as static assets; no server-side rendering |
| Component system | shadcn/ui + Radix + Tailwind | Provides accessible primitives, themeable via CSS variables |
| State management | React hooks (local state per page) | `src/pages/Index.tsx` acts as orchestrator |
| Graph workspace | React Flow 11 | Handles nodes, edges, connection gestures, and mini-map |
| Styling | Tailwind CSS + custom CSS variables | Light/dark theme handled with CSS vars + `useTheme` hook |
| Notifications | Sonner | Toast feedback for add/remove/export actions |

There is intentionally no backend dependency; upstream systems can embed AnnotateX alongside existing APIs or persistence layers.

---

## 2. Data Model

```ts
interface AnnotationMetadata {
  sentiment?: "positive" | "neutral" | "negative" | "mixed";
  confidence?: number;
  notes?: string;
}

interface Annotation {
  id: string;
  start: number;
  end: number;
  text: string;
  labelId: string;
  label: string;
  color: string;
  metadata?: AnnotationMetadata;
}

interface Relationship {
  id: string;
  source: string;   // annotation id
  target: string;   // annotation id
  type: string;     // maps to Schema.relationTypes
}

interface LabelCapabilities {
  sentiment?: boolean;
  confidence?: boolean;
  notes?: boolean;
}

interface Label {
  id: string;
  name: string;
  color: string;
  capabilities?: LabelCapabilities;
}

interface Schema {
  labels: Label[];
  relationTypes: { id: string; name: string }[];
}

interface DocumentRecord {
  id: string;
  name: string;
  type: "txt" | "pdf" | "unknown";
  size: number;
  lastModified?: number;
  text: string;
  annotations: Annotation[];
  relationships: Relationship[];
  status: "ready" | "loading" | "error";
  error?: string;
  origin?: "sample" | "uploaded";
}
```

`Index.tsx` now tracks:

- `documents`: array of `DocumentRecord` (one per uploaded txt/pdf)
- `activeDocumentId`: controls which document is rendered across editor/workbench/graph
- `schema`: shared labels + relation types
- `selectedAnnotationId`: scoped to the active document

All surface components receive callbacks to mutate this shared state, keeping every panel in sync.

---

## 3. Document Management & Dataset Loader

- Users load a complete directory via a hidden `<input type="file" webkitdirectory>` picker.
- Each file becomes a `DocumentRecord`:
  - **txt/md** files are read directly via `File.text()`.
  - **pdf** files are parsed client-side using `pdfjs-dist`; page text is concatenated for annotation.
  - Unsupported or unreadable files remain in the dataset drawer with `status: "error"`.
- The Document Toolbar (beneath the header) displays:
  - Navigation arrows (`⌥ + ←/→` hotkeys)
  - Current document metadata (format badge, size, position `n/N`)
  - Progress bar (documents containing annotations/relationships vs total)
  - Dataset drawer listing every file with counts and errors
- Switching documents swaps the `text`, `annotations`, and `relationships` injected into the editor, workbench, graph, and JSON viewer.
- Exports can target the active document or the entire dataset (JSON/CSV).
- The sample document is automatically removed once a real dataset with at least one readable file is imported.

---

## 4. Component Responsibilities

| Component | Path | Responsibilities |
| --- | --- | --- |
| `TextEditor` | `src/components/TextEditor.tsx` | Text selection, floating label menu, inline sentiment picker, link-mode toggles |
| `SchemaPanel` | `src/components/SchemaPanel.tsx` | Manage labels, relation types, metadata capabilities |
| `AnnotationWorkbench` | `src/components/AnnotationWorkbench.tsx` | Inspect selected annotation, edit metadata, list & delete relationships |
| `GraphPanel` | `src/components/GraphPanel.tsx` | Render nodes/edges via React Flow, accept drag-to-connect gestures, confirm direction/type |
| `JsonViewer` | `src/components/JsonViewer.tsx` | Preview normalized JSON in real time |
| `ExportDialog` | `src/components/ExportDialog.tsx` | JSON/CSV export with RFC‑4180-safe quoting |

---

## 5. Selection & Offset Handling

Annotated spans remain stable thanks to a DOM-aware offset calculator in `TextEditor`:

1. The editor renders text plus annotation badges. Metadata badges are marked with `data-exclude-offset="true"`.
2. `calculateSelectionOffsets` walks only text nodes (skipping excluded elements) to compute accurate `start`/`end` positions, even after annotations insert extra DOM.
3. Relationships reference annotation IDs, so exports can always map back to original text spans.

---

## 6. Graph Interaction Flow

1. Each annotation becomes a node. Initial positions are tile-based, but user drags persist via `nodePositions`.
2. Users drag from one handle to another. React Flow emits a `Connection`; AnnotateX pauses to ask for:
   - **Direction** (source → target or reversed)
   - **Relation type** (select from schema)
3. Confirming creates a `Relationship` entry shared by Workbench, JSON, and Export features.
4. Deleting an edge in the graph (select + Delete key) calls `onRemoveRelationship`, updating global state.

Edge labels use the schema’s friendly name and sit on a lightly tinted background for readability on both light/dark themes.

---

## 7. Export Format

### JSON

```json
{
  "text": "Original text…",
  "annotations": [
    {
      "id": "ann-1709500000000",
      "span": [0, 5],
      "text": "Elon",
      "labelId": "person",
      "label": "Person",
      "metadata": {
        "location": "Left lung apex",
        "severity": "Moderate"
      }
    }
  ],
  "relationships": [
    {
      "id": "rel-1709500000100",
      "source": "ann-…",
      "target": "ann-…",
      "type": "founded"
    }
  ]
}
```

### CSV Columns

AnnotateX emits dynamic columns based on your schema. The header always begins with

```
Document,ID,Start,End,Text,Label
```

and appends one column per custom property (e.g., `Location`, `Severity`, `Notes`). Every cell is quoted/escaped when needed so spreadsheets can import without corruption.

---

## 8. Deployment Checklist

1. **Build**: `npm run build` (produces `dist/`)
2. **Containerize**: Use `Dockerfile` (serves via Nginx). Ensure environment variables (if any) are injected at runtime.
3. **Reverse Proxy**: Terminate TLS at your ingress (Nginx/Traefik/Envoy). Forward traffic to container port 80.
4. **Headers**: Add CSP, HSTS, Referrer-Policy, and X-Frame-Options according to your security policy.
5. **Auth**: Protect behind SSO or VPN. AnnotateX itself is stateless; integrate with your platform’s auth gateway.

---

## 9. Roadmap Considerations

Planned enhancements (high-level):

- **Command palette** – `⌘K` to jump between annotations, labels, documents, or schema actions.
- **Schema templates & validations** – shareable ontologies plus rule enforcement (e.g., cardinality constraints).
- **AI-assisted suggestions** – optional inference layer for candidate spans and relationships.
- **Collaboration hooks** – multi-user presence, annotation comments, audit log.

Each feature will keep the “glassmorphic” aesthetic and avoid clutter—preferring drawers, popovers, and keyboard shortcuts.

---

## 10. Branding

- Brand palette lives in `src/index.css`. Change the CSS custom properties (`--primary`, `--accent`, etc.) to match your institution’s style guide.
- The header/badge copy is controlled inside `src/components/Header.tsx`.
- Drop a hero image at `public/brand-banner.jpg` (PNG/JPG/WebP) to override the default gradient banner rendered by `BrandBanner`.
- Replace `public/favicon.svg` with an SVG of your lab logo to customize the browser tab icon.

---

For questions or custom integrations, reach out to the AnnotateX maintainers. This document should evolve alongside the codebase; update it whenever architecture or workflows change.

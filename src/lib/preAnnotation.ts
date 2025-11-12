import type { Annotation, AnnotationSuggestion, Schema } from "@/types/annotation";
import { buildDefaultMetadata } from "./annotations";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PRESET_HINTS: Record<string, string[]> = {
  cardiomegaly: ["cardiomegaly", "cardiomegal", "cardiac silhouette"],
  pleural_effusion: ["pleural effusion"],
  pneumothorax: ["pneumothorax"],
  consolidation: ["consolidation", "airspace opacity", "airspace opacities"],
  pneumonia: ["pneumonia", "infectious process"],
};

const hasOverlap = (
  start: number,
  end: number,
  spans: Array<{ start: number; end: number }>,
) => spans.some((span) => span.start < end && span.end > start);

export const generatePreAnnotationSuggestions = (
  text: string,
  schema: Schema,
  existingAnnotations: Annotation[],
): AnnotationSuggestion[] => {
  if (!text.trim()) return [];

  const results: AnnotationSuggestion[] = [];
  const occupiedSpans = [
    ...existingAnnotations.map(({ start, end }) => ({ start, end })),
  ];

  schema.labels.forEach((label) => {
    const hints = PRESET_HINTS[label.id] ?? PRESET_HINTS[label.name.toLowerCase()] ?? [label.name];
    const regexes = hints.map((hint) => new RegExp(escapeRegExp(hint), "gi"));

    regexes.forEach((regex) => {
      for (const match of text.matchAll(regex)) {
        if (match.index === undefined) continue;
        const start = match.index;
        const end = start + match[0].length;

        if (hasOverlap(start, end, occupiedSpans)) {
          continue;
        }

        occupiedSpans.push({ start, end });

        results.push({
          id: `suggestion-${label.id}-${start}-${end}`,
          start,
          end,
          text: match[0],
          labelId: label.id,
          label: label.name,
          color: label.color,
          metadata: buildDefaultMetadata(label),
          status: "pending",
          confidence: Math.min(0.95, 0.65 + Math.random() * 0.3),
          source: "Assist Preview",
        });
      }
    });
  });

  return results
    .sort((a, b) => a.start - b.start)
    .slice(0, 24);
};

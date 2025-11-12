import type { Annotation, AnnotationSuggestion, Schema } from "@/types/annotation";

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

const getBucket = (
  store: Map<string, Array<{ start: number; end: number }>>,
  labelId: string,
) => {
  if (!store.has(labelId)) {
    store.set(labelId, []);
  }
  return store.get(labelId)!;
};

const expandToSentence = (text: string, matchStart: number, matchEnd: number) => {
  let start = matchStart;
  let end = matchEnd;

  while (start > 0) {
    const char = text[start - 1];
    if (".!?…\n".includes(char)) {
      break;
    }
    start--;
  }
  while (end < text.length) {
    const char = text[end];
    if (".!?…\n".includes(char)) {
      end++;
      break;
    }
    end++;
  }

  // Trim whitespace but keep offsets aligned.
  while (start < matchStart && /\s/.test(text[start])) start++;
  while (end > matchEnd && /\s/.test(text[end - 1])) end--;

  return { start, end };
};

export const generatePreAnnotationSuggestions = (
  text: string,
  schema: Schema,
  existingAnnotations: Annotation[],
): AnnotationSuggestion[] => {
  if (!text.trim()) return [];

  const results: AnnotationSuggestion[] = [];
  const occupiedSpans = new Map<string, Array<{ start: number; end: number }>>();
  existingAnnotations.forEach(({ labelId, start, end }) => {
    getBucket(occupiedSpans, labelId).push({ start, end });
  });

  schema.labels.forEach((label) => {
    const hints = PRESET_HINTS[label.id] ?? PRESET_HINTS[label.name.toLowerCase()] ?? [label.name];
    const regexes = hints.map((hint) => new RegExp(escapeRegExp(hint), "gi"));

    regexes.forEach((regex) => {
      for (const match of text.matchAll(regex)) {
        if (match.index === undefined) continue;
        const start = match.index;
        const end = start + match[0].length;

        const bucket = getBucket(occupiedSpans, label.id);
        if (hasOverlap(start, end, bucket)) {
          continue;
        }

        const contextRange = expandToSentence(text, start, end);
        const contextSnippet = text.slice(contextRange.start, contextRange.end).trim();
        bucket.push({ start: contextRange.start, end: contextRange.end });

        results.push({
          id: `suggestion-${label.id}-${contextRange.start}-${contextRange.end}`,
          start: contextRange.start,
          end: contextRange.end,
          text: contextSnippet,
          labelId: label.id,
          label: label.name,
          color: label.color,
          metadata: undefined,
          status: "pending",
          confidence: Math.min(0.95, 0.65 + Math.random() * 0.3),
          source: "Assist Preview",
          context: contextSnippet,
        });
      }
    });
  });

  return results
    .sort((a, b) => a.start - b.start)
    .slice(0, 24);
};

import type {
  Annotation,
  AnnotationMetadata,
  AnnotationSuggestion,
  Label,
  LabelProperty,
  Schema,
} from "@/types/annotation";
import type { AssistConfig } from "@/types/assist";
import { generatePreAnnotationSuggestions } from "./preAnnotation";

const PROPERTY_BATCH_SIZE = 4;

interface AssistResult {
  suggestions: AnnotationSuggestion[];
  sourceLabel: string;
}

interface PropertyFillItem {
  id: string;
  labelId: string;
  labelName: string;
  context: string;
}

interface PropertyFillResponse {
  id: string;
  properties?: Record<string, unknown>;
}

const sanitizeHost = (host: string) => {
  if (!host) {
    return "http://localhost:11434";
  }
  return host.endsWith("/") ? host.slice(0, -1) : host;
};

const hasOverlap = (start: number, end: number, spans: Array<{ start: number; end: number }>) =>
  spans.some((span) => span.start < end && span.end > start);

const getOccupiedBucket = (
  store: Map<string, Array<{ start: number; end: number }>>,
  labelId: string,
) => {
  if (!store.has(labelId)) {
    store.set(labelId, []);
  }
  return store.get(labelId)!;
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const locateSpan = (
  text: string,
  snippet: string,
  occupied: Map<string, Array<{ start: number; end: number }>>,
  labelId: string,
): { start: number; end: number } | null => {
  if (!snippet.trim()) return null;
  let searchIndex = 0;
  while (searchIndex < text.length) {
    const found = text.indexOf(snippet, searchIndex);
    if (found === -1) break;
    const span = { start: found, end: found + snippet.length };
    if (!hasOverlap(span.start, span.end, getOccupiedBucket(occupied, labelId))) {
      return span;
    }
    searchIndex = span.end;
  }
  return null;
};

const describeLabel = (label: Label) => {
  if (!label.properties?.length) {
    return `- ${label.id} (${label.name})`;
  }
  const propertySummary = label.properties
    .map((property) => `${property.id}:${property.type}`)
    .join(", ");
  return `- ${label.id} (${label.name}) · properties: ${propertySummary}`;
};

const buildOllamaPrompt = (text: string, schema: Schema, maxSuggestions: number) => {
  const labelDescriptions = schema.labels.map(describeLabel).join("\n");
  return [
    "You assist radiology annotators by returning every text span that matches their schema.",
    "Respond ONLY with a JSON array. Each element must follow exactly:",
    '{"labelId":"cardiomegaly","text":"exact substring copied verbatim","start":120,"end":145,"confidence":0.92,"context":"full sentence or clause that justifies the label","properties":{"severity":{"value":"Moderate","evidence":"sentence fragment proving the severity"},"presence":{"value":"Yes","evidence":"phrase showing presence"}}}',
    "Rules:",
    "- Use schema labelId values exactly as provided.",
    "- start/end are zero-based character offsets referencing the document string.",
    "- text must match the document substring for that range (do not paraphrase).",
    "- context should be the full sentence/phrase that proves the label and can span multiple lines if needed.",
    "- properties must include only the schema-defined fields. For each property, return an object with `value` and an `evidence` snippet pulled directly from the document.",
    "- Include every occurrence for each label when evidence exists; omit labels with no supporting span.",
    `- Return at most ${maxSuggestions} spans (prioritize clinically important mentions).`,
    "Schema:",
    labelDescriptions,
    "Document:",
    '"""',
    text,
    '"""',
  ].join("\n");
};

const normalizeCandidates = (rawSuggestions: Array<Record<string, unknown>>) => {
  const flattened: Array<Record<string, unknown>> = [];
  rawSuggestions.forEach((candidate) => {
    const spans = Array.isArray((candidate as Record<string, unknown>).spans)
      ? ((candidate as Record<string, unknown>).spans as Array<Record<string, unknown>>)
      : null;
    if (spans && spans.length) {
      spans.forEach((span) => {
        flattened.push({
          ...candidate,
          ...span,
          labelId: span.labelId ?? candidate.labelId,
          label: span.label ?? candidate.label,
          text: span.text ?? candidate.text,
          confidence: span.confidence ?? candidate.confidence,
          properties: span.properties ?? candidate.properties,
        });
      });
    } else {
      flattened.push(candidate);
    }
  });
  return flattened;
};

const normalizeBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["true", "yes", "present", "positive", "1", "y"].includes(normalized)) return true;
    if (["false", "no", "absent", "negative", "0", "n"].includes(normalized)) return false;
  }
  return undefined;
};

const normalizeNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const normalizeSelect = (value: unknown, property: LabelProperty): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const raw = String(value).trim();
  if (!raw.length) return undefined;
  if (property.options?.length) {
    const match = property.options.find((option) => option.toLowerCase() === raw.toLowerCase());
    return match ?? undefined;
  }
  return raw;
};

const needsPropertyCompletion = (suggestion: AnnotationSuggestion, label?: Label) => {
  if (!label?.properties?.length) {
    return false;
  }
  if (!suggestion.metadata) {
    return true;
  }
  return label.properties.some((property) => {
    const current = suggestion.metadata?.[property.id];
    if (property.type === "boolean") {
      return typeof current !== "boolean";
    }
    if (property.type === "number") {
      return typeof current !== "number";
    }
    return current === undefined || current === null || `${current}`.trim() === "";
  });
};

const normalizePropertySource = (candidateProperties: unknown): Record<string, unknown> | null => {
  if (!candidateProperties || typeof candidateProperties !== "object") {
    return null;
  }

  if (Array.isArray(candidateProperties)) {
    const fromArray: Record<string, unknown> = {};
    candidateProperties.forEach((entry) => {
      if (entry && typeof entry === "object") {
        const key =
          ("id" in entry && typeof entry.id === "string" && entry.id) ||
          ("name" in entry && typeof entry.name === "string" && entry.name);
        if (key) {
          fromArray[key] = entry;
        }
      }
    });
    return Object.keys(fromArray).length ? fromArray : null;
  }

  return candidateProperties as Record<string, unknown>;
};

const pickPropertyCandidate = (
  property: LabelProperty,
  source: Record<string, unknown>,
): { value: unknown; rawEntry: unknown } | null => {
  const sanitize = (input: string | undefined) =>
    input
      ?.toString()
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();

  const possibleKeys = new Set<string>();
  const normalizedKeys = new Set<string>();
  const pushKey = (value?: string) => {
    if (!value) return;
    possibleKeys.add(value);
    const normalized = sanitize(value);
    if (normalized) {
      normalizedKeys.add(normalized);
    }
  };

  pushKey(property.id);
  pushKey(property.name);

  const entries = Object.entries(source);

  for (const [key, rawValue] of entries) {
    const normalizedKey = sanitize(key);
    if (possibleKeys.has(key) || (normalizedKey && normalizedKeys.has(normalizedKey))) {
      return { value: rawValue, rawEntry: rawValue };
    }
  }

  if ("properties" in source) {
    const nested = normalizePropertySource((source as Record<string, unknown>).properties);
    if (nested) {
      const nestedEntry = pickPropertyCandidate(property, nested);
      if (nestedEntry) {
        return nestedEntry;
      }
    }
  }

  return null;
};

const parsePropertiesFromModel = (
  label: Label,
  candidateProperties: unknown,
): { metadata?: AnnotationMetadata; evidence?: Record<string, string> } => {
  const base: AnnotationMetadata = {};
  const evidence: Record<string, string> = {};
  const normalizedSource = normalizePropertySource(candidateProperties);

  if (normalizedSource) {
    label.properties?.forEach((property) => {
      const entry = pickPropertyCandidate(property, normalizedSource);
      if (!entry) return;
      const raw = entry.value;
      if (raw === undefined || raw === null) return;

      const rawValue =
        typeof raw === "object" && raw !== null && "value" in (raw as Record<string, unknown>)
          ? (raw as Record<string, unknown>).value
          : raw;
      const rawEvidence =
        typeof raw === "object" && raw !== null && "evidence" in (raw as Record<string, unknown>)
          ? (raw as Record<string, unknown>).evidence
          : undefined;

      switch (property.type) {
        case "boolean": {
          const boolValue = normalizeBoolean(rawValue);
          if (typeof boolValue === "boolean") {
            base[property.id] = boolValue;
          }
          break;
        }
        case "number": {
          const numericValue = normalizeNumber(rawValue);
          if (numericValue !== undefined) {
            base[property.id] = numericValue;
          }
          break;
        }
        case "select": {
          const selectValue = normalizeSelect(rawValue, property);
          if (selectValue !== undefined) {
            base[property.id] = selectValue;
          }
          break;
        }
        case "text":
        default:
          base[property.id] = String(rawValue);
          break;
      }

      if (typeof rawEvidence === "string" && rawEvidence.trim().length) {
        evidence[property.id] = rawEvidence.trim();
      }
    });
  }

  return {
    metadata: Object.keys(base).length ? base : undefined,
    evidence: Object.keys(evidence).length ? evidence : undefined,
  };
};

const SELECT_FALLBACK_PRIORITY = ["n/a", "not applicable", "none", "no finding", "absent", "na"];

const selectFallbackValue = (property: LabelProperty): string | undefined => {
  const options = property.options ?? [];
  if (!options.length) return undefined;
  const normalized = options.map((option) => option.trim().toLowerCase());
  for (const target of SELECT_FALLBACK_PRIORITY) {
    const index = normalized.findIndex((value) => value === target);
    if (index !== -1) {
      return options[index];
    }
  }
  return options[0];
};

const applySelectFallbacks = (
  suggestions: AnnotationSuggestion[],
  labelLookup: Map<string, Label>,
): AnnotationSuggestion[] =>
  suggestions.map((suggestion) => {
    const label = labelLookup.get(suggestion.labelId);
    if (!label?.properties?.length) {
      return suggestion;
    }

    let metadata = suggestion.metadata ? { ...suggestion.metadata } : undefined;
    let propertyEvidence = suggestion.propertyEvidence ? { ...suggestion.propertyEvidence } : undefined;
    let changed = false;

    label.properties.forEach((property) => {
      if (property.type !== "select") return;
      const current = metadata?.[property.id];
      if (isValueFilled(current)) return;
      const fallback = selectFallbackValue(property);
      if (!fallback) return;
      if (!metadata) metadata = {};
      metadata[property.id] = fallback;
      if (!propertyEvidence) propertyEvidence = {};
      if (!propertyEvidence[property.id]) {
        propertyEvidence[property.id] = "Auto-set to fallback because assist returned no value.";
      }
      changed = true;
    });

    if (!changed) {
      return suggestion;
    }

    return {
      ...suggestion,
      metadata,
      propertyEvidence,
    };
  });

const requestPropertyFillBatch = async (
  items: PropertyFillItem[],
  labelLookup: Map<string, Label>,
  config: AssistConfig,
) => {
  if (!items.length) {
    return [];
  }
  const normalizedHost = sanitizeHost(config.ollamaHost);
  const prompt = buildPropertyFillPrompt(items, labelLookup);
  const response = await fetch(`${normalizedHost}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.ollamaModel,
      prompt,
      stream: false,
      options: {
        temperature: Math.min(config.temperature, 0.4),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Property fill returned ${response.status}`);
  }

  const payload = await response.json();
  const raw = typeof payload?.response === "string" ? payload.response : JSON.stringify(payload);
  const jsonBlock = extractJsonBlock(raw);
  const parsed = JSON.parse(jsonBlock);
  if (!Array.isArray(parsed)) {
    throw new Error("Property fill engine did not return a JSON array.");
  }
  return parsed as PropertyFillResponse[];
};

const enrichSuggestionsWithProperties = async (
  suggestions: AnnotationSuggestion[],
  schema: Schema,
  config: AssistConfig,
): Promise<AnnotationSuggestion[]> => {
  if (config.mode !== "ollama" || !suggestions.length) {
    return suggestions;
  }

  const labelLookup = new Map(schema.labels.map((label) => [label.id, label]));
  const pending = suggestions.filter((suggestion) =>
    needsPropertyCompletion(suggestion, labelLookup.get(suggestion.labelId)),
  );

  if (!pending.length) {
    return suggestions;
  }

  const batches = chunkArray(pending, PROPERTY_BATCH_SIZE);
  const updates = new Map<string, Record<string, unknown>>();

  for (const batch of batches) {
    const items = batch.map<PropertyFillItem>((suggestion) => ({
      id: suggestion.id,
      labelId: suggestion.labelId,
      labelName: suggestion.label,
      context: (suggestion.context ?? suggestion.text ?? "").slice(0, 1500),
    }));

    try {
      const results = await requestPropertyFillBatch(items, labelLookup, config);
      results.forEach((entry, index) => {
        const fallbackId = items[index]?.id;
        const targetId =
          typeof entry?.id === "string" && entry.id.length
            ? entry.id
            : fallbackId;
        if (targetId && entry?.properties) {
          updates.set(targetId, entry.properties);
        }
      });
    } catch (error) {
      console.warn("Property fill batch failed:", error);
    }
  }

  const withUpdates = updates.size
    ? suggestions.map((suggestion) => {
        const label = labelLookup.get(suggestion.labelId);
        const update = updates.get(suggestion.id);
        if (!label || !update) {
          return suggestion;
        }

    const { metadata, evidence } = parsePropertiesFromModel(label, update);
    if (!metadata && !evidence) {
      return suggestion;
    }

        return {
          ...suggestion,
          metadata: {
            ...suggestion.metadata,
            ...metadata,
          },
          propertyEvidence: {
            ...(suggestion.propertyEvidence ?? {}),
            ...(evidence ?? {}),
          },
        };
      })
    : suggestions;

  return applySelectFallbacks(withUpdates, labelLookup);
};

const describePropertyForPrompt = (property: LabelProperty) => {
  const base = `- ${property.id} (${property.name})`;
  switch (property.type) {
    case "boolean":
      return `${base}: boolean (true if evidence supports it, false otherwise).`;
    case "number":
      return `${base}: number (use numeric value).`;
    case "select":
      return `${base}: select one of [${property.options?.join(", ") ?? "N/A"}].`;
    default:
      return `${base}: free text.`;
  }
};

const buildPropertyFillPrompt = (
  items: PropertyFillItem[],
  labelLookup: Map<string, Label>,
) => {
  const example = JSON.stringify(
    [
      {
        id: "assist-example",
        properties: {
          presence: { value: true, evidence: "Explicit phrase showing the finding" },
          severity: { value: "Mild", evidence: "Clause describing severity" },
        },
      },
    ],
    null,
    2,
  );

  const header = [
    "You finalize annotation properties for radiology spans.",
    "For each item, analyze the label + context and fill EVERY schema property.",
    "Respond ONLY with JSON array. Shape:",
    example,
    "Rules:",
    "- Use the property ids exactly as provided.",
    "- Boolean values must be true or false (no strings).",
    "- Select values must match the allowed options (case-insensitive).",
    "- Always include an evidence snippet (quote from the context) for each property.",
    "- If a property truly has no support, choose the 'N/A' option or leave value null, but still explain in evidence.",
    "- Never omit a property.",
    "",
    "Items:",
  ];

  const body = items
    .map((item, index) => {
      const label = labelLookup.get(item.labelId);
      const propertyLines = label?.properties?.length
        ? label.properties.map((property) => `    ${describePropertyForPrompt(property)}`).join("\n")
        : "    (No properties for this label.)";
      const context = (item.context ?? "").trim();
      return [
        `${index + 1}. id: ${item.id}`,
        `   label: ${label?.name ?? item.labelName} (${item.labelId})`,
        "   properties:",
        propertyLines,
        "   context:",
        '   """',
        `   ${context}`,
        '   """',
      ].join("\n");
    })
    .join("\n\n");

  return [...header, body].join("\n");
};

const clampConfidence = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Math.min(Math.max(value, 0), 1);
};

const extractJsonBlock = (raw: string) => {
  const match = raw.match(/\[[\s\S]*]/);
  return match ? match[0] : raw;
};

const mapOllamaOutput = (
  text: string,
  schema: Schema,
  rawSuggestions: Array<Record<string, unknown>>,
  maxSuggestions: number,
  source: string,
): AnnotationSuggestion[] => {
  const suggestions: AnnotationSuggestion[] = [];
  const occupied = new Map<string, Array<{ start: number; end: number }>>();

  normalizeCandidates(rawSuggestions)
    .slice(0, maxSuggestions)
    .forEach((candidate, index) => {
      const labelId = typeof candidate.labelId === "string" ? candidate.labelId : undefined;
      const labelName = typeof candidate.label === "string" ? candidate.label : undefined;
      const label =
        schema.labels.find((l) => l.id === labelId) ??
        (labelName ? schema.labels.find((l) => l.name.toLowerCase() === labelName.toLowerCase()) : undefined);
      if (!label) return;

      const rawStart = typeof candidate.start === "number" ? candidate.start : undefined;
      const rawEnd = typeof candidate.end === "number" ? candidate.end : undefined;
      let span: { start: number; end: number } | null = null;

      if (
        typeof rawStart === "number" &&
        typeof rawEnd === "number" &&
        rawStart >= 0 &&
        rawEnd <= text.length &&
        rawEnd > rawStart
      ) {
        const candidateSpan = { start: rawStart, end: rawEnd };
        if (!hasOverlap(candidateSpan.start, candidateSpan.end, getOccupiedBucket(occupied, label.id))) {
          span = candidateSpan;
        }
      }

      const candidateText = typeof candidate.text === "string" ? candidate.text : "";
      let contextText =
        typeof candidate.context === "string" && candidate.context.trim().length
          ? candidate.context.trim()
          : undefined;

      if (contextText) {
        const contextIndex = text.indexOf(contextText);
        if (contextIndex !== -1) {
          const contextSpan = { start: contextIndex, end: contextIndex + contextText.length };
          if (!hasOverlap(contextSpan.start, contextSpan.end, getOccupiedBucket(occupied, label.id))) {
            span = contextSpan;
          }
        }
      }

      if (!span) {
        span = locateSpan(text, candidateText, occupied, label.id);
      }

      if (!span) {
        return;
      }

      getOccupiedBucket(occupied, label.id).push(span);

      const snippetText = text.slice(span.start, span.end);
      if (!contextText || contextText === candidateText) {
        contextText = snippetText;
      }
      const confidence = clampConfidence(candidate.confidence as number | undefined);
      const { metadata, evidence } = parsePropertiesFromModel(
        label,
        (candidate as Record<string, unknown>).properties,
      );

      suggestions.push({
        id: `assist-ollama-${label.id}-${span.start}-${span.end}-${index}`,
        start: span.start,
        end: span.end,
        text: snippetText,
        labelId: label.id,
        label: label.name,
        color: label.color,
        metadata,
        status: "pending",
        confidence,
        source,
        context: contextText,
        propertyEvidence: evidence,
      });
    });

  return suggestions;
};

const ensureLabelCoverage = (
  primary: AnnotationSuggestion[],
  heuristics: AnnotationSuggestion[],
): { suggestions: AnnotationSuggestion[]; supplemented: boolean } => {
  const covered = new Set(primary.map((suggestion) => suggestion.labelId));
  const additions: AnnotationSuggestion[] = [];

  heuristics.forEach((suggestion, index) => {
    if (covered.has(suggestion.labelId)) {
      return;
    }
    additions.push({
      ...suggestion,
      id: `${suggestion.id}-heuristic-fill-${index}`,
      source: "Heuristics fill",
    });
    covered.add(suggestion.labelId);
  });

  return {
    suggestions: [...primary, ...additions],
    supplemented: additions.length > 0,
  };
};

const requestOllamaSuggestions = async (
  text: string,
  schema: Schema,
  _annotations: Annotation[],
  config: AssistConfig,
): Promise<AssistResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const normalizedHost = sanitizeHost(config.ollamaHost);
    const response = await fetch(`${normalizedHost}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: buildOllamaPrompt(text, schema, config.maxSuggestions),
        stream: false,
        options: {
          temperature: config.temperature,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Assist engine returned ${response.status}`);
    }

    const payload = await response.json();
    const raw = typeof payload?.response === "string" ? payload.response : JSON.stringify(payload);
    const jsonBlock = extractJsonBlock(raw);
    const parsed = JSON.parse(jsonBlock);
    if (!Array.isArray(parsed)) {
      throw new Error("Assist engine did not return a JSON array");
    }

    let suggestions = mapOllamaOutput(
      text,
      schema,
      parsed as Array<Record<string, unknown>>,
      config.maxSuggestions,
      `Ollama · ${config.ollamaModel}`,
    );

    suggestions = await enrichSuggestionsWithProperties(suggestions, schema, config);

    if (!suggestions.length) {
      throw new Error("Assist engine responded but no spans were matched in the document.");
    }

    return { suggestions, sourceLabel: `Ollama (${config.ollamaModel})` };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `Assist request timed out after ${Math.round(config.timeoutMs / 1000)}s. Check the Ollama endpoint or increase the timeout.`,
      );
    }
    throw error instanceof Error ? error : new Error("Assist request failed unexpectedly.");
  } finally {
    clearTimeout(timeout);
  }
};

export const generateAssistSuggestions = async (
  text: string,
  schema: Schema,
  annotations: Annotation[],
  config: AssistConfig,
): Promise<AssistResult> => {
  const getHeuristics = () => generatePreAnnotationSuggestions(text, schema, annotations);

  if (config.mode === "ollama") {
    try {
      const result = await requestOllamaSuggestions(text, schema, annotations, config);
      const heuristicSuggestions = getHeuristics();
      const { suggestions, supplemented } = ensureLabelCoverage(result.suggestions, heuristicSuggestions);
      return {
        suggestions,
        sourceLabel: supplemented ? `${result.sourceLabel} + heuristic fill` : result.sourceLabel,
      };
    } catch (error) {
      console.warn("Assist engine fallback to heuristics:", error);
      return {
        suggestions: getHeuristics(),
        sourceLabel: "Heuristics (fallback)",
      };
    }
  }

  return {
    suggestions: getHeuristics(),
    sourceLabel: "Heuristics",
  };
};

export const testAssistConnection = async (config: AssistConfig): Promise<string> => {
  if (config.mode === "heuristic") {
    return "Heuristic mode runs locally—no endpoint needed.";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 5000));
  try {
    const normalizedHost = sanitizeHost(config.ollamaHost);
    const response = await fetch(`${normalizedHost}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: "Respond with []",
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Endpoint responded with status ${response.status}`);
    }

    return "Connection successful. Ready to request suggestions.";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Connection test timed out. Verify the host/port and try again.");
    }
    throw error instanceof Error ? error : new Error("Connection test failed.");
  } finally {
    clearTimeout(timeout);
  }
};

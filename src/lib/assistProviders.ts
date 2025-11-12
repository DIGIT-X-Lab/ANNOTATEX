import type { Annotation, AnnotationSuggestion, Schema } from "@/types/annotation";
import type { AssistConfig } from "@/types/assist";
import { generatePreAnnotationSuggestions } from "./preAnnotation";
import { buildDefaultMetadata } from "./annotations";

interface AssistResult {
  suggestions: AnnotationSuggestion[];
  sourceLabel: string;
}

const sanitizeHost = (host: string) => {
  if (!host) {
    return "http://localhost:11434";
  }
  return host.endsWith("/") ? host.slice(0, -1) : host;
};

const hasOverlap = (start: number, end: number, spans: Array<{ start: number; end: number }>) =>
  spans.some((span) => span.start < end && span.end > start);

const locateSpan = (
  text: string,
  snippet: string,
  occupied: Array<{ start: number; end: number }>,
): { start: number; end: number } | null => {
  if (!snippet.trim()) return null;
  let searchIndex = 0;
  while (searchIndex < text.length) {
    const found = text.indexOf(snippet, searchIndex);
    if (found === -1) break;
    const span = { start: found, end: found + snippet.length };
    if (!hasOverlap(span.start, span.end, occupied)) {
      return span;
    }
    searchIndex = span.end;
  }
  return null;
};

const buildOllamaPrompt = (text: string, schema: Schema, maxSuggestions: number) => {
  const limitedText = text.length > 4000 ? `${text.slice(0, 4000)}…` : text;
  return [
    "You help radiology annotation teams highlight entities.",
    "Respond ONLY with a JSON array (no prose) describing up to",
    `${maxSuggestions} suggestions. Format:`,
    '[{ "labelId": "cardiomegaly", "text": "Mild cardiomegaly", "confidence": 0.82 }]',
    "Valid label ids:",
    schema.labels.map((label) => `- ${label.id}: ${label.name}`).join("\n"),
    "Document:",
    '"""',
    limitedText,
    '"""',
  ].join("\n");
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
  const occupied: Array<{ start: number; end: number }> = [];

  rawSuggestions.slice(0, maxSuggestions).forEach((candidate, index) => {
    const labelId = typeof candidate.labelId === "string" ? candidate.labelId : undefined;
    const labelName = typeof candidate.label === "string" ? candidate.label : undefined;
    const snippet = typeof candidate.text === "string" ? candidate.text : "";
    if (!snippet.trim()) return;

    const label =
      schema.labels.find((l) => l.id === labelId) ??
      (labelName ? schema.labels.find((l) => l.name.toLowerCase() === labelName.toLowerCase()) : undefined);
    if (!label) return;

    const span = locateSpan(text, snippet, occupied);
    if (!span) return;

    occupied.push(span);

    const confidence =
      typeof candidate.confidence === "number"
        ? Math.min(Math.max(candidate.confidence, 0), 1)
        : 0.65 + Math.random() * 0.2;

    suggestions.push({
      id: `assist-ollama-${label.id}-${span.start}-${index}`,
      start: span.start,
      end: span.end,
      text: snippet,
      labelId: label.id,
      label: label.name,
      color: label.color,
      metadata: buildDefaultMetadata(label),
      status: "pending",
      confidence,
      source,
    });
  });

  return suggestions;
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

    const suggestions = mapOllamaOutput(
      text,
      schema,
      parsed as Array<Record<string, unknown>>,
      config.maxSuggestions,
      `Ollama · ${config.ollamaModel}`,
    );

    if (!suggestions.length) {
      throw new Error("Assist engine responded but no spans were matched in the document.");
    }

    return { suggestions, sourceLabel: `Ollama (${config.ollamaModel})` };
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
  if (config.mode === "ollama") {
    try {
      return await requestOllamaSuggestions(text, schema, annotations, config);
    } catch (error) {
      console.warn("Assist engine fallback to heuristics:", error);
      return {
        suggestions: generatePreAnnotationSuggestions(text, schema, annotations),
        sourceLabel: "Heuristics (fallback)",
      };
    }
  }

  return {
    suggestions: generatePreAnnotationSuggestions(text, schema, annotations),
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
  } finally {
    clearTimeout(timeout);
  }
};

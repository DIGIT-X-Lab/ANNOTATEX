import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { DocumentToolbar } from "@/components/DocumentToolbar";
import { BrandBanner } from "@/components/BrandBanner";
import { TextEditor } from "@/components/TextEditor";
import { JsonViewer } from "@/components/JsonViewer";
import { SchemaPanel } from "@/components/SchemaPanel";
import { ExportDialog } from "@/components/ExportDialog";
import { AnnotationWorkbench } from "@/components/AnnotationWorkbench";
import { GraphPanel } from "@/components/GraphPanel";
import { AssistSettingsDrawer } from "@/components/AssistSettingsDrawer";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Annotation, Schema, Relationship, AnnotationMetadata, AnnotationSuggestion } from "@/types/annotation";
import type { DocumentRecord, DocumentType } from "@/types/document";
import type { AssistConfig } from "@/types/assist";
import { defaultAssistConfig } from "@/types/assist";
import { toast } from "sonner";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker?url";
import { generateAssistSuggestions, testAssistConnection, warmAssistEngine } from "@/lib/assistProviders";
import { generatePreAnnotationSuggestions } from "@/lib/preAnnotation";
import { attachCleanVariants } from "@/lib/textCleaner";

const SAMPLE_TEXT =
  "CHEST X-RAY (PA AND LATERAL)\n\nClinical History: 66-year-old with dyspnea.\n\nFindings:\n1. Patchy airspace opacities in the right mid and lower lung compatible with pneumonia.\n2. Mild cardiomegaly with prominent pulmonary vasculature.\n3. No pleural effusion or pneumothorax.\n\nImpression:\nRight lower-lobe consolidation consistent with infectious process. Recommend clinical correlation and short-term follow-up imaging.";

const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

const createSampleDocument = (): DocumentRecord =>
  attachCleanVariants({
    id: generateId(),
    name: "Sample Document",
    type: "txt",
    size: SAMPLE_TEXT.length,
    text: SAMPLE_TEXT,
    annotations: [],
    suggestions: [],
    relationships: [],
    status: "ready",
    origin: "sample",
  });

if (typeof window !== "undefined") {
  GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
}

const deriveDocumentType = (filename: string): DocumentType => {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "txt" || extension === "md") return "txt";
  if (extension === "pdf") return "pdf";
  return "unknown";
};

const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    text += `${pageText}\n`;
  }
  return text.trim();
};

const spansOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && aEnd > bStart;

const ASSIST_CONFIG_KEY = "annotatex.assistConfig";

const mapRawRangeToClean = (start: number, end: number, reverseMap: number[]) => {
  if (start < 0 || end <= start || end > reverseMap.length) {
    return null;
  }
  const cleanStart = reverseMap[start];
  const cleanEndIndex = reverseMap[end - 1];
  if (cleanStart === undefined || cleanStart < 0 || cleanEndIndex === undefined || cleanEndIndex < 0) {
    return null;
  }
  return { start: cleanStart, end: cleanEndIndex + 1 };
};

const mapCleanRangeToRaw = (start: number, end: number, forwardMap: number[]) => {
  if (start < 0 || end <= start || end > forwardMap.length) {
    return null;
  }
  const rawStart = forwardMap[start];
  const rawEndIndex = forwardMap[end - 1];
  if (rawStart === undefined || rawStart < 0 || rawEndIndex === undefined || rawEndIndex < 0) {
    return null;
  }
  return { start: rawStart, end: rawEndIndex + 1 };
};

const buildAnnotationsForAssist = (doc: DocumentRecord): Annotation[] => {
  if (!doc.cleanText || !doc.cleanReverseMap?.length) {
    return doc.annotations;
  }
  const next: Annotation[] = [];
  doc.annotations.forEach((annotation) => {
    const mapped = mapRawRangeToClean(annotation.start, annotation.end, doc.cleanReverseMap!);
    if (!mapped) {
      return;
    }
    next.push({
      ...annotation,
      start: mapped.start,
      end: mapped.end,
      text: doc.cleanText!.slice(mapped.start, mapped.end),
    });
  });
  return next;
};
type CleanRange = { start: number; end: number };

const findAvailableSpan = (
  sourceLower: string,
  needleLower: string,
  occupied: CleanRange[],
): CleanRange | null => {
  if (!needleLower.length) return null;
  let fromIndex = 0;
  while (fromIndex <= sourceLower.length - needleLower.length) {
    const idx = sourceLower.indexOf(needleLower, fromIndex);
    if (idx === -1) break;
    const end = idx + needleLower.length;
    const overlaps = occupied.some((range) => range.start < end && range.end > idx);
    if (!overlaps) {
      return { start: idx, end };
    }
    fromIndex = idx + 1;
  }
  return null;
};

const adjustConfidence = (value: number | undefined, factor: number) => {
  const base = typeof value === "number" && !Number.isNaN(value) ? value : 0.9;
  return Math.min(Math.max(base * factor, 0), 1);
};

const assignSuggestionsToRawText = (
  doc: DocumentRecord,
  suggestions: AnnotationSuggestion[],
  schema: Schema,
): AnnotationSuggestion[] => {
  const canUseClean = Boolean(
    doc.cleanText && doc.cleanMap?.length && doc.cleanReverseMap?.length && doc.text.length,
  );
  const sourceText = canUseClean ? doc.cleanText! : doc.text;
  const sourceLower = sourceText.toLowerCase();
  const occupied = new Map<string, CleanRange[]>();
  const getRanges = (labelId: string) => {
    if (!occupied.has(labelId)) {
      occupied.set(labelId, []);
    }
    return occupied.get(labelId)!;
  };
  const heuristicsByLabel = new Map<string, AnnotationSuggestion[]>();
  const heuristicsPool = generatePreAnnotationSuggestions(doc.text, schema, doc.annotations);
  heuristicsPool.forEach((entry) => {
    if (!heuristicsByLabel.has(entry.labelId)) {
      heuristicsByLabel.set(entry.labelId, []);
    }
    heuristicsByLabel.get(entry.labelId)!.push(entry);
  });
  const results: AnnotationSuggestion[] = [];

  const convertToRawSpan = (span: CleanRange): CleanRange | null => {
    if (!canUseClean || !doc.cleanMap) {
      return span;
    }
    return mapCleanRangeToRaw(span.start, span.end, doc.cleanMap) ?? null;
  };

  suggestions.forEach((suggestion) => {
    if (canUseClean && suggestion.end > suggestion.start) {
      if (suggestion.end > sourceText.length) {
        return;
      }
      const cleanSpan = { start: suggestion.start, end: suggestion.end };
      getRanges(suggestion.labelId).push(cleanSpan);
      const rawSpan = convertToRawSpan(cleanSpan);
      if (!rawSpan) {
        return;
      }
      results.push({
        ...suggestion,
        start: rawSpan.start,
        end: rawSpan.end,
        text: doc.text.slice(rawSpan.start, rawSpan.end),
      });
      return;
    }

    if (!canUseClean && suggestion.end > suggestion.start) {
      const clampedEnd = Math.min(suggestion.end, doc.text.length);
      if (clampedEnd <= suggestion.start) {
        return;
      }
      results.push({
        ...suggestion,
        start: suggestion.start,
        end: clampedEnd,
        text: doc.text.slice(suggestion.start, clampedEnd),
      });
      return;
    }

    const candidate = (suggestion.text ?? "").trim();
    if (!candidate.length) {
      return;
    }
    const candidateLower = candidate.toLowerCase();
    let span = findAvailableSpan(sourceLower, candidateLower, getRanges(suggestion.labelId));
    let matchQuality: "exact" | "context" | null = span ? "exact" : null;

    if (!span && suggestion.context) {
      const contextNeedle = suggestion.context.trim().toLowerCase();
      const contextSpan = findAvailableSpan(sourceLower, contextNeedle, getRanges(suggestion.labelId));
      if (contextSpan) {
        const contextSlice = sourceLower.slice(contextSpan.start, contextSpan.end);
        const innerIdx = contextSlice.indexOf(candidateLower);
        span =
          innerIdx >= 0
            ? {
                start: contextSpan.start + innerIdx,
                end: contextSpan.start + innerIdx + candidateLower.length,
              }
            : contextSpan;
        matchQuality = innerIdx >= 0 ? "exact" : "context";
      }
    }

    if (span) {
      getRanges(suggestion.labelId).push(span);
      const rawSpan = convertToRawSpan(span);
      if (!rawSpan) {
        console.warn(`[AI Assist] Failed to map clean span for "${candidate}" in "${doc.name}"`);
        return;
      }
      const factor = matchQuality === "context" ? 0.85 : 1;
      results.push({
        ...suggestion,
        start: rawSpan.start,
        end: rawSpan.end,
        text: doc.text.slice(rawSpan.start, rawSpan.end),
        confidence: adjustConfidence(suggestion.confidence, factor),
      });
      return;
    }

    const fallbackPool = heuristicsByLabel.get(suggestion.labelId);
    const fallback = fallbackPool?.shift();
    if (fallback) {
      results.push({
        ...suggestion,
        start: fallback.start,
        end: fallback.end,
        text: doc.text.slice(fallback.start, fallback.end),
        confidence: adjustConfidence(suggestion.confidence, 0.6),
        context: fallback.context ?? suggestion.context,
      });
    } else {
      console.warn(`[AI Assist] Unable to locate span for "${candidate}" in "${doc.name}"`);
    }
  });

  return results;
};

const Index = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([createSampleDocument()]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(documents[0]?.id ?? null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [schema, setSchema] = useState<Schema>({
    labels: [
      {
        id: "cardiomegaly",
        name: "Cardiomegaly",
        color: "#00B8D9",
        properties: [
          { id: "presence", name: "Presence", type: "boolean" },
          {
            id: "severity",
            name: "Severity",
            type: "select",
            options: ["Mild", "Medium", "Severe", "N/A"],
          },
        ],
      },
      {
        id: "pleural_effusion",
        name: "Pleural effusion",
        color: "#8B5CF6",
        properties: [
          { id: "presence", name: "Presence", type: "boolean" },
          {
            id: "severity",
            name: "Severity",
            type: "select",
            options: ["Mild", "Medium", "Severe", "N/A"],
          },
        ],
      },
      {
        id: "pneumothorax",
        name: "Pneumothorax",
        color: "#10B981",
        properties: [
          { id: "presence", name: "Presence", type: "boolean" },
          {
            id: "severity",
            name: "Severity",
            type: "select",
            options: ["Mild", "Medium", "Severe", "N/A"],
          },
        ],
      },
      {
        id: "consolidation",
        name: "Consolidation",
        color: "#F59E0B",
        properties: [
          { id: "presence", name: "Presence", type: "boolean" },
          {
            id: "severity",
            name: "Severity",
            type: "select",
            options: ["Mild", "Medium", "Severe", "N/A"],
          },
        ],
      },
      {
        id: "pneumonia",
        name: "Pneumonia",
        color: "#F97316",
        properties: [
          { id: "presence", name: "Presence", type: "boolean" },
          {
            id: "severity",
            name: "Severity",
            type: "select",
            options: ["Mild", "Medium", "Severe", "N/A"],
          },
        ],
      },
    ],
    relationTypes: [
      { id: "associated_with", name: "Associated With" },
      { id: "located_in", name: "Located In" },
      { id: "progression_of", name: "Progression Of" },
    ],
  });
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assistEnabled, setAssistEnabled] = useState(false);
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistConfig, setAssistConfig] = useState<AssistConfig>(defaultAssistConfig);
  const [isAssistSettingsOpen, setIsAssistSettingsOpen] = useState(false);
  const [isTestingAssist, setIsTestingAssist] = useState(false);
  const [assistTestMessage, setAssistTestMessage] = useState<string | null>(null);
  const [isRunningAssistAll, setIsRunningAssistAll] = useState(false);
  const [isWarmingAssist, setIsWarmingAssist] = useState(false);

  const activeDocument = useMemo(
    () => documents.find((doc) => doc.id === activeDocumentId) ?? documents[0] ?? null,
    [documents, activeDocumentId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(ASSIST_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AssistConfig;
        setAssistConfig({ ...defaultAssistConfig, ...parsed });
      }
    } catch (error) {
      console.warn("Failed to load assist config, using defaults.", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ASSIST_CONFIG_KEY, JSON.stringify(assistConfig));
    } catch (error) {
      console.warn("Failed to persist assist config.", error);
    }
  }, [assistConfig]);

  useEffect(() => {
    if (!activeDocument && documents[0]) {
      setActiveDocumentId(documents[0].id);
    }
  }, [activeDocument, documents]);

  useEffect(() => {
    if (!activeDocument) {
      setSelectedAnnotationId(null);
      return;
    }
    if (selectedAnnotationId && !activeDocument.annotations.some((ann) => ann.id === selectedAnnotationId)) {
      setSelectedAnnotationId(null);
    }
  }, [activeDocument, selectedAnnotationId]);

  const mutateActiveDocument = useCallback(
    (updater: (doc: DocumentRecord) => DocumentRecord) => {
      if (!activeDocumentId) return;
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === activeDocumentId ? updater(doc) : doc)),
      );
    },
    [activeDocumentId],
  );

  const handleSetText = (nextText: string) => {
    mutateActiveDocument((doc) => attachCleanVariants({ ...doc, text: nextText }));
  };

  const handleAddAnnotation = (annotation: Annotation) => {
    mutateActiveDocument((doc) => ({
      ...doc,
      annotations: [...doc.annotations, annotation],
      suggestions: doc.suggestions.map((suggestion) =>
        suggestion.status === "pending" && spansOverlap(annotation.start, annotation.end, suggestion.start, suggestion.end)
          ? { ...suggestion, status: "superseded" }
          : suggestion,
      ),
    }));
    setSelectedAnnotationId(annotation.id);
  };

  const handleRemoveAnnotation = (id: string) => {
    mutateActiveDocument((doc) => ({
      ...doc,
      annotations: doc.annotations.filter((a) => a.id !== id),
      relationships: doc.relationships.filter((r) => r.source !== id && r.target !== id),
    }));
    setSelectedAnnotationId((prev) => (prev === id ? null : prev));
  };

  const handleAcceptSuggestion = (suggestionId: string) => {
    let createdAnnotationId: string | null = null;
    mutateActiveDocument((doc) => {
      const suggestion = doc.suggestions.find((s) => s.id === suggestionId);
      if (!suggestion) {
        return doc;
      }
      const newAnnotation: Annotation = {
        id: `ann-${generateId()}`,
        start: suggestion.start,
        end: suggestion.end,
        text: suggestion.text,
        labelId: suggestion.labelId,
        label: suggestion.label,
        color: suggestion.color,
        metadata: suggestion.metadata,
        context: suggestion.context,
        propertyEvidence: suggestion.propertyEvidence,
      };
      createdAnnotationId = newAnnotation.id;
      return {
        ...doc,
        annotations: [...doc.annotations, newAnnotation],
        suggestions: doc.suggestions.map((s) =>
          s.id === suggestionId ? { ...s, status: "accepted" } : s,
        ),
      };
    });
    if (createdAnnotationId) {
      setSelectedAnnotationId(createdAnnotationId);
      toast.success("Suggestion accepted", {
        description: "Converted into a live annotation.",
      });
    }
  };

  const handleRejectSuggestion = (suggestionId: string) => {
    mutateActiveDocument((doc) => ({
      ...doc,
      suggestions: doc.suggestions.map((suggestion) =>
        suggestion.id === suggestionId ? { ...suggestion, status: "rejected" } : suggestion,
      ),
    }));
    toast.info("Suggestion dismissed", {
      description: "Hidden from the assist queue for this document.",
    });
  };

  const handleUpdateAnnotationMetadata = (id: string, metadata: Partial<AnnotationMetadata>) => {
    mutateActiveDocument((doc) => ({
      ...doc,
      annotations: doc.annotations.map((annotation) => {
        if (annotation.id !== id) {
          return annotation;
        }

        const updatedMetadata = { ...annotation.metadata, ...metadata };
        let updatedEvidence = annotation.propertyEvidence
          ? { ...annotation.propertyEvidence }
          : undefined;

        if (updatedEvidence) {
          Object.keys(metadata).forEach((key) => {
            if (key in updatedEvidence) {
              delete updatedEvidence[key];
            }
          });
          if (Object.keys(updatedEvidence).length === 0) {
            updatedEvidence = undefined;
          }
        }

        return {
          ...annotation,
          metadata: updatedMetadata,
          propertyEvidence: updatedEvidence,
        };
      }),
    }));
  };

  const handleAddRelationship = (relationship: Relationship) => {
    mutateActiveDocument((doc) => ({
      ...doc,
      relationships: [...doc.relationships, relationship],
    }));
  };

  const handleRemoveRelationship = (id: string) => {
    mutateActiveDocument((doc) => ({
      ...doc,
      relationships: doc.relationships.filter((r) => r.id !== id),
    }));
  };

  const selectedAnnotation = useMemo(() => {
    if (!activeDocument) return null;
    return activeDocument.annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;
  }, [activeDocument, selectedAnnotationId]);

  const handleSelectDocument = useCallback((documentId: string) => {
    setActiveDocumentId(documentId);
  }, []);

  const handlePreviousDocument = useCallback(() => {
    if (!activeDocumentId) return;
    const index = documents.findIndex((doc) => doc.id === activeDocumentId);
    if (index > 0) {
      setActiveDocumentId(documents[index - 1].id);
    }
  }, [activeDocumentId, documents]);

  const handleNextDocument = useCallback(() => {
    if (!activeDocumentId) return;
    const index = documents.findIndex((doc) => doc.id === activeDocumentId);
    if (index >= 0 && index < documents.length - 1) {
      setActiveDocumentId(documents[index + 1].id);
    }
  }, [activeDocumentId, documents]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const interactiveTags = new Set(["INPUT", "TEXTAREA", "SELECT"]);
      const tagName = activeElement?.tagName ? activeElement.tagName.toUpperCase() : "";
      const isTyping =
        activeElement &&
        (interactiveTags.has(tagName) ||
          activeElement.isContentEditable ||
          activeElement.getAttribute("role") === "textbox");
      if (isTyping) return;

      const isBareLeft =
        event.key === "ArrowLeft" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
      const isBareRight =
        event.key === "ArrowRight" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
      const isAltLeft = event.key === "ArrowLeft" && event.altKey;
      const isAltRight = event.key === "ArrowRight" && event.altKey;

      if (isBareRight || isAltRight) {
        event.preventDefault();
        handleNextDocument();
      }
      if (isBareLeft || isAltLeft) {
        event.preventDefault();
        handlePreviousDocument();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [handleNextDocument, handlePreviousDocument]);

  const handleTriggerDatasetPicker = () => {
    fileInputRef.current?.click();
  };

  const handleDatasetChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setIsImporting(true);
    try {
      const nextDocuments: DocumentRecord[] = [];

      for (const file of files) {
        const docType = deriveDocumentType(file.name);
        const name =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath?.length
            ? (file as File & { webkitRelativePath?: string }).webkitRelativePath
            : file.name;
        try {
          const text = docType === "pdf" ? await extractTextFromPdf(file) : await file.text();
          if (!text.trim()) {
            throw new Error("No extractable text");
          }
          nextDocuments.push(
            attachCleanVariants({
              id: generateId(),
              name,
              type: docType,
              size: file.size,
              lastModified: file.lastModified,
              text,
              annotations: [],
              suggestions: [],
              relationships: [],
              status: "ready",
              origin: "uploaded",
            }),
          );
        } catch (error) {
          nextDocuments.push(
            attachCleanVariants({
              id: generateId(),
              name,
              type: docType,
              size: file.size,
              lastModified: file.lastModified,
              text: "",
              annotations: [],
              suggestions: [],
              relationships: [],
              status: "error",
              error: error instanceof Error ? error.message : "Failed to process file",
              origin: "uploaded",
            }),
          );
        }
      }

      setDocuments((prev) => {
        const hasReadyDocs = nextDocuments.some((doc) => doc.status === "ready");
        const base = hasReadyDocs ? prev.filter((doc) => doc.origin !== "sample") : prev;
        return [...base, ...nextDocuments];
      });

      const firstReady = nextDocuments.find((doc) => doc.status === "ready");
      if (firstReady) {
        setActiveDocumentId(firstReady.id);
      }
      toast.success(`Loaded ${nextDocuments.length} document${nextDocuments.length === 1 ? "" : "s"}`);
    } finally {
      setIsImporting(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const assistInFlightRef = useRef<Set<string>>(new Set());
  const autoAssistPrimedRef = useRef<Set<string>>(new Set());

  const runAssistSuggestions = useCallback(
    async (docId: string, options: { force?: boolean; silent?: boolean } = {}) => {
      const { force = false, silent = false } = options;
      const targetDocument = documents.find((doc) => doc.id === docId);
      if (!targetDocument) return;
      if (!targetDocument.text.trim()) {
        toast.error("No text to analyze for suggestions.");
        return;
      }
      if (!force && targetDocument.suggestions.length > 0) {
        return;
      }

      if (assistInFlightRef.current.has(docId)) {
        return;
      }
      assistInFlightRef.current.add(docId);
      autoAssistPrimedRef.current.add(docId);

      if (!silent) {
        setAssistLoading(true);
      }
      try {
        console.debug(`[AI Assist] Requesting suggestions for "${targetDocument.name}" (${docId})`);
        const textForAssist = targetDocument.cleanText ?? targetDocument.text;
        const annotationsForAssist = buildAnnotationsForAssist(targetDocument);
        const { suggestions: generated, sourceLabel } = await generateAssistSuggestions(
          textForAssist,
          schema,
          annotationsForAssist,
          assistConfig,
        );

        const normalizedSuggestions = assignSuggestionsToRawText(targetDocument, generated, schema);

        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === docId
              ? {
                  ...doc,
                  suggestions: normalizedSuggestions,
                }
              : doc,
          ),
        );

        if (normalizedSuggestions.length) {
          toast.success(
            `Assist (${sourceLabel}) suggested ${normalizedSuggestions.length} span${
              normalizedSuggestions.length === 1 ? "" : "s"
            }`,
          );
        } else {
          toast.info("Assist couldn't find suggestions for this document.");
        }
      } catch (error) {
        toast.error("Assist engine failed", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        assistInFlightRef.current.delete(docId);
        if (!silent) {
          setAssistLoading(false);
        }
      }
    },
    [assistConfig, documents, schema],
  );

  const handleToggleAssist = (enabled: boolean) => {
    if (!enabled) {
      setAssistEnabled(false);
      return;
    }
    if (isRunningAssistAll || isWarmingAssist) {
      toast.info("AI Assist is already running", {
        description: "Wait for the current job to finish before toggling again.",
      });
      return;
    }

    setAssistEnabled(true);
    void (async () => {
      const requiresWarmup = assistConfig.mode === "ollama";
      try {
        if (requiresWarmup) {
          setIsWarmingAssist(true);
          await warmAssistEngine(assistConfig);
        }
        if (activeDocumentId) {
          await runAssistSuggestions(activeDocumentId);
        }
      } catch (error) {
        setAssistEnabled(false);
        toast.error("Failed to prepare AI Assist", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        if (requiresWarmup) {
          setIsWarmingAssist(false);
        }
      }
    })();
  };

  const handleRunAssistAll = useCallback(async () => {
    const readyDocs = documents.filter(
      (doc) => doc.status === "ready" && (doc.text?.trim()?.length ?? 0) > 0,
    );
    if (!readyDocs.length) {
      toast.info("No ready documents available for AI Assist.");
      return;
    }
    const shouldEnableAssist = !assistEnabled;
    if (shouldEnableAssist) {
      setAssistEnabled(true);
    }
    setIsRunningAssistAll(true);
    try {
      if (assistConfig.mode === "ollama") {
        setIsWarmingAssist(true);
        try {
          await warmAssistEngine(assistConfig);
        } finally {
          setIsWarmingAssist(false);
        }
      }
      let processed = 0;
      for (const doc of readyDocs) {
        await runAssistSuggestions(doc.id, { force: true, silent: true });
        processed += 1;
      }
      toast.success(`AI Assist processed ${processed} document${processed === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error("AI Assist batch run failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsRunningAssistAll(false);
    }
  }, [assistEnabled, documents, runAssistSuggestions]);

  const handleRefreshSuggestions = () => {
    if (!activeDocumentId) return;
    if (isRunningAssistAll) {
      toast.info("Batch assist already running", {
        description: "Pause individual refreshes until the global run completes.",
      });
      return;
    }
    void runAssistSuggestions(activeDocumentId, { force: true });
  };

  const handleUpdateAssistConfig = (next: AssistConfig) => {
    setAssistConfig(next);
  };

  const handleTestAssistEngine = async () => {
    setIsTestingAssist(true);
    setAssistTestMessage(null);
    try {
      const message = await testAssistConnection(assistConfig);
      setAssistTestMessage(message);
      toast.success("Assist engine reachable", { description: message });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Unknown error";
      setAssistTestMessage(description);
      toast.error("Assist engine test failed", { description });
    } finally {
      setIsTestingAssist(false);
    }
  };

  useEffect(() => {
    if (!assistEnabled || !activeDocumentId) return;
    const currentDoc = documents.find((doc) => doc.id === activeDocumentId);
    if (
      !currentDoc ||
      currentDoc.status !== "ready" ||
      !currentDoc.text.trim() ||
      autoAssistPrimedRef.current.has(currentDoc.id)
    ) {
      return;
    }
    if (currentDoc.suggestions.length === 0) {
      void runAssistSuggestions(currentDoc.id);
    }
  }, [assistEnabled, activeDocumentId, documents, runAssistSuggestions]);

  const annotations = activeDocument?.annotations ?? [];
  const relationships = activeDocument?.relationships ?? [];
  const text = activeDocument?.text ?? SAMPLE_TEXT;
  const cleanText = activeDocument?.cleanText;
  const suggestions = activeDocument?.suggestions ?? [];
  const assistEngineLabel =
    assistConfig.mode === "ollama" ? `Ollama · ${assistConfig.ollamaModel}` : "Heuristic";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <BrandBanner />
      <DocumentToolbar
        documents={documents}
        activeDocumentId={activeDocumentId}
        onSelectDocument={handleSelectDocument}
        onPreviousDocument={handlePreviousDocument}
        onNextDocument={handleNextDocument}
        onTriggerDatasetPicker={handleTriggerDatasetPicker}
        isImporting={isImporting}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".txt,.md,.pdf"
        onChange={handleDatasetChange}
        // @ts-expect-error - directory selection is not typed in React
        webkitdirectory=""
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1 border-t border-border">
        <ResizablePanel defaultSize={50} minSize={35} className="overflow-auto">
          <TextEditor
            text={text}
            cleanText={cleanText}
            setText={handleSetText}
            annotations={annotations}
            onAddAnnotation={handleAddAnnotation}
            onRemoveAnnotation={handleRemoveAnnotation}
            schema={schema}
            onAddRelationship={handleAddRelationship}
            selectedAnnotation={selectedAnnotation}
            selectedAnnotationId={selectedAnnotationId}
            onSelectAnnotation={setSelectedAnnotationId}
            onUpdateAnnotationMetadata={handleUpdateAnnotationMetadata}
            suggestions={suggestions}
            assistEnabled={assistEnabled}
            assistLoading={assistLoading}
            assistWarming={isWarmingAssist}
            onToggleAssist={handleToggleAssist}
            assistEngineLabel={assistEngineLabel}
            onOpenAssistSettings={() => setIsAssistSettingsOpen(true)}
            onAcceptSuggestion={handleAcceptSuggestion}
            onRejectSuggestion={handleRejectSuggestion}
            onRefreshSuggestions={handleRefreshSuggestions}
            onRunAssistAll={handleRunAssistAll}
            isRunningAssistAll={isRunningAssistAll}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={25} minSize={20} className="border-l border-border overflow-auto">
          <JsonViewer text={text} annotations={annotations} relationships={relationships} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={25} minSize={20} className="border-l border-border bg-muted/30 overflow-hidden">
          <Tabs defaultValue="schema" className="h-full flex flex-col">
            <div className="px-4 pt-4">
              <TabsList className="w-full">
                <TabsTrigger className="flex-1" value="schema">
                  Schema
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="workbench">
                  Workbench
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="graph">
                  Graph
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="schema" className="flex-1 overflow-hidden">
              <SchemaPanel schema={schema} onUpdateSchema={setSchema} />
            </TabsContent>
            <TabsContent value="workbench" className="flex-1 overflow-hidden">
              <AnnotationWorkbench
                annotations={annotations}
                selectedAnnotationId={selectedAnnotationId}
                onSelectAnnotation={setSelectedAnnotationId}
                onRemoveAnnotation={handleRemoveAnnotation}
                onUpdateMetadata={handleUpdateAnnotationMetadata}
                relationships={relationships}
                onRemoveRelationship={handleRemoveRelationship}
                schema={schema}
              />
            </TabsContent>
            <TabsContent value="graph" className="flex-1 overflow-hidden">
              <GraphPanel
                annotations={annotations}
                relationships={relationships}
                schema={schema}
                selectedAnnotationId={selectedAnnotationId}
                onSelectAnnotation={setSelectedAnnotationId}
                onAddRelationship={handleAddRelationship}
                onRemoveRelationship={handleRemoveRelationship}
              />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>

      <ExportDialog documents={documents} activeDocumentId={activeDocumentId} schema={schema} />
      <AssistSettingsDrawer
        open={isAssistSettingsOpen}
        onOpenChange={setIsAssistSettingsOpen}
        config={assistConfig}
        onConfigChange={handleUpdateAssistConfig}
        onTestConnection={handleTestAssistEngine}
        testing={isTestingAssist}
        testMessage={assistTestMessage}
      />
    </div>
  );
};

export default Index;

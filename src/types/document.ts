import type { Annotation, AnnotationSuggestion, Relationship } from "@/types/annotation";

export type DocumentType = "txt" | "pdf" | "unknown";

export interface DocumentRecord {
  id: string;
  name: string;
  type: DocumentType;
  size: number;
  lastModified?: number;
  text: string;
  cleanText?: string;
  cleanMap?: number[];
  cleanReverseMap?: number[];
  annotations: Annotation[];
  suggestions: AnnotationSuggestion[];
  relationships: Relationship[];
  status: "ready" | "loading" | "error";
  error?: string;
  origin?: "sample" | "uploaded";
}

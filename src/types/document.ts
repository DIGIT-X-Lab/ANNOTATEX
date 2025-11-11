import type { Annotation, Relationship } from "@/types/annotation";

export type DocumentType = "txt" | "pdf" | "unknown";

export interface DocumentRecord {
  id: string;
  name: string;
  type: DocumentType;
  size: number;
  lastModified?: number;
  text: string;
  annotations: Annotation[];
  relationships: Relationship[];
  status: "ready" | "loading" | "error";
  error?: string;
  origin?: "sample" | "uploaded";
}

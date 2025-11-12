export type PropertyType = "text" | "number" | "boolean" | "select";

export interface LabelProperty {
  id: string;
  name: string;
  type: PropertyType;
  options?: string[];
  required?: boolean;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  properties?: LabelProperty[];
}

export interface RelationType {
  id: string;
  name: string;
}

export interface Schema {
  labels: Label[];
  relationTypes: RelationType[];
}

export interface Annotation {
  id: string;
  start: number;
  end: number;
  text: string;
  labelId: string;
  label: string;
  color: string;
  metadata?: AnnotationMetadata;
  context?: string;
  propertyEvidence?: Record<string, string>;
}

export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: string;
}

export type AnnotationMetadata = Record<string, string | number | boolean | null | undefined>;

export type SuggestionStatus = "pending" | "accepted" | "rejected" | "superseded";

export interface AnnotationSuggestion extends Annotation {
  status: SuggestionStatus;
  confidence?: number;
  source?: string;
}

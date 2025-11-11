export interface LabelProperty {
  id: string;
  name: string;
  type: "text";
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
}

export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: string;
}

export type AnnotationMetadata = Record<string, string | number | null | undefined>;

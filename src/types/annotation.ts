export interface Label {
  id: string;
  name: string;
  color: string;
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
  label: string;
  color: string;
}

export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: string;
}

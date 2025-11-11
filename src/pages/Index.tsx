import { useState } from "react";
import { Header } from "@/components/Header";
import { TextEditor } from "@/components/TextEditor";
import { JsonViewer } from "@/components/JsonViewer";
import { SchemaPanel } from "@/components/SchemaPanel";
import { ExportDialog } from "@/components/ExportDialog";
import type { Annotation, Schema, Relationship } from "@/types/annotation";

const Index = () => {
  const [text, setText] = useState(
    "Elon Musk founded SpaceX in 2002. The company is headquartered in Hawthorne, California. SpaceX develops and manufactures spacecraft."
  );
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [schema, setSchema] = useState<Schema>({
    labels: [
      { id: "person", name: "Person", color: "#00B8D9" },
      { id: "organization", name: "Organization", color: "#8B5CF6" },
      { id: "location", name: "Location", color: "#10B981" },
      { id: "date", name: "Date", color: "#F59E0B" },
    ],
    relationTypes: [
      { id: "founded", name: "founded" },
      { id: "located_in", name: "located in" },
      { id: "works_for", name: "works for" },
    ],
  });

  const handleAddAnnotation = (annotation: Annotation) => {
    setAnnotations([...annotations, annotation]);
  };

  const handleRemoveAnnotation = (id: string) => {
    setAnnotations(annotations.filter((a) => a.id !== id));
    setRelationships(relationships.filter((r) => r.source !== id && r.target !== id));
  };

  const handleAddRelationship = (relationship: Relationship) => {
    setRelationships([...relationships, relationship]);
  };

  const handleRemoveRelationship = (id: string) => {
    setRelationships(relationships.filter((r) => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Text Editor */}
        <div className="flex-1 border-r border-border overflow-auto">
          <TextEditor
            text={text}
            setText={setText}
            annotations={annotations}
            onAddAnnotation={handleAddAnnotation}
            onRemoveAnnotation={handleRemoveAnnotation}
            schema={schema}
            relationships={relationships}
            onAddRelationship={handleAddRelationship}
            onRemoveRelationship={handleRemoveRelationship}
          />
        </div>

        {/* Right Panel - JSON Viewer */}
        <div className="w-[400px] border-r border-border overflow-auto">
          <JsonViewer
            text={text}
            annotations={annotations}
            relationships={relationships}
          />
        </div>

        {/* Schema Panel */}
        <div className="w-[320px] overflow-auto bg-muted/30">
          <SchemaPanel schema={schema} onUpdateSchema={setSchema} />
        </div>
      </div>

      <ExportDialog
        text={text}
        annotations={annotations}
        relationships={relationships}
      />
    </div>
  );
};

export default Index;

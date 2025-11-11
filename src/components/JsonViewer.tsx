import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Annotation, Relationship } from "@/types/annotation";

interface JsonViewerProps {
  text: string;
  annotations: Annotation[];
  relationships: Relationship[];
}

export const JsonViewer = ({ text, annotations, relationships }: JsonViewerProps) => {
  const jsonOutput = {
    text,
    annotations: annotations.map((ann) => ({
      id: ann.id,
      span: [ann.start, ann.end],
      text: ann.text,
      labelId: ann.labelId,
      label: ann.label,
      metadata: ann.metadata,
    })),
    relationships: relationships.map((rel) => ({
      id: rel.id,
      source: rel.source,
      target: rel.target,
      type: rel.type,
    })),
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Live JSON Output</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Updates automatically with each annotation
        </p>
      </div>

      <ScrollArea className="flex-1">
        <Card className="m-4 p-4 bg-muted/50">
          <pre className="text-xs font-mono overflow-x-auto">
            {JSON.stringify(jsonOutput, null, 2)}
          </pre>
        </Card>
      </ScrollArea>
    </div>
  );
};

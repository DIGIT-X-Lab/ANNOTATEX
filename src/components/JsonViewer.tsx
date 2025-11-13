import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
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
  const jsonString = JSON.stringify(jsonOutput, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      toast.success("JSON copied");
    } catch (error) {
      toast.error("Unable to copy JSON", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `annotatex-${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Unable to download JSON", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Live JSON Output</h2>
          <p className="text-sm text-muted-foreground mt-1">Updates automatically with each annotation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleCopy} title="Copy JSON">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleDownload} title="Download JSON">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Card className="m-4 p-4 bg-muted/50">
          <pre className="text-xs font-mono overflow-x-auto">{jsonString}</pre>
        </Card>
      </ScrollArea>
    </div>
  );
};

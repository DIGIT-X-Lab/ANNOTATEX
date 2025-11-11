import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import type { Annotation, Relationship } from "@/types/annotation";
import { toast } from "sonner";

interface ExportDialogProps {
  text: string;
  annotations: Annotation[];
  relationships: Relationship[];
}

export const ExportDialog = ({ text, annotations, relationships }: ExportDialogProps) => {
  const [open, setOpen] = useState(false);

  const exportToJson = () => {
    const data = {
      text,
      annotations: annotations.map((ann) => ({
        id: ann.id,
        span: [ann.start, ann.end],
        text: ann.text,
        label: ann.label,
      })),
      relationships: relationships.map((rel) => ({
        id: rel.id,
        source: rel.source,
        target: rel.target,
        type: rel.type,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `annotations-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exported successfully");
    setOpen(false);
  };

  const exportToCsv = () => {
    const rows = [
      ["ID", "Start", "End", "Text", "Label"],
      ...annotations.map((ann) => [ann.id, ann.start, ann.end, ann.text, ann.label]),
    ];

    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `annotations-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 shadow-lg"
          size="lg"
        >
          <Download className="w-5 h-5 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Annotations</DialogTitle>
          <DialogDescription>Choose your export format</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={exportToJson}
          >
            <FileJson className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Export as JSON</div>
              <div className="text-xs text-muted-foreground">
                Structured format with all annotations and relationships
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={exportToCsv}
          >
            <FileSpreadsheet className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Export as CSV</div>
              <div className="text-xs text-muted-foreground">
                Tabular format for spreadsheet applications
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

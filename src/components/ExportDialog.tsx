import { useMemo, useState } from "react";
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
import type { DocumentRecord } from "@/types/document";
import type { Schema, LabelProperty } from "@/types/annotation";
import { toast } from "sonner";

interface ExportDialogProps {
  documents: DocumentRecord[];
  activeDocumentId: string | null;
  schema: Schema;
}

const escapeCell = (value: string | number) => {
  const cell = String(value ?? "");
  if (cell.includes('"') || cell.includes(",") || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
};

const createJsonPayload = (doc: DocumentRecord) => ({
  name: doc.name,
  type: doc.type,
  text: doc.text,
  annotations: doc.annotations.map((ann) => ({
    id: ann.id,
    span: [ann.start, ann.end],
    text: ann.text,
    labelId: ann.labelId,
    label: ann.label,
    metadata: ann.metadata,
  })),
  relationships: doc.relationships.map((rel) => ({
    id: rel.id,
    source: rel.source,
    target: rel.target,
    type: rel.type,
  })),
});

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const derivePropertyColumns = (schema: Schema): LabelProperty[] => {
  const map = new Map<string, LabelProperty>();
  schema.labels.forEach((label) => {
    label.properties?.forEach((property) => {
      if (!map.has(property.id)) {
        map.set(property.id, property);
      }
    });
  });
  return Array.from(map.values());
};

export const ExportDialog = ({ documents, activeDocumentId, schema }: ExportDialogProps) => {
  const [open, setOpen] = useState(false);
  const activeDocument = useMemo(
    () => documents.find((doc) => doc.id === activeDocumentId) ?? documents[0],
    [documents, activeDocumentId],
  );
  const propertyColumns = useMemo(() => derivePropertyColumns(schema), [schema]);

  const exportDocumentJson = (doc: DocumentRecord | undefined) => {
    if (!doc) return;
    const payload = createJsonPayload(doc);
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `${doc.name.replace(/\W+/g, "-").toLowerCase()}-${Date.now()}.json`,
    );
    toast.success(`Exported ${doc.name} (JSON)`);
    setOpen(false);
  };

  const exportDocumentCsv = (doc: DocumentRecord | undefined) => {
    if (!doc) return;
    const header = [
      "Document",
      "ID",
      "Start",
      "End",
      "Text",
      "Label",
      ...propertyColumns.map((property) => property.name),
    ];
    const rows = [
      header,
      ...doc.annotations.map((ann) => [
        doc.name,
        ann.id,
        ann.start,
        ann.end,
        ann.text,
        ann.label,
        ...propertyColumns.map((property) => ann.metadata?.[property.id] ?? ""),
      ]),
    ];
    const csvContent = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
    downloadBlob(
      new Blob([csvContent], { type: "text/csv" }),
      `${doc.name.replace(/\W+/g, "-").toLowerCase()}-${Date.now()}.csv`,
    );
    toast.success(`Exported ${doc.name} (CSV)`);
    setOpen(false);
  };

  const exportAllJson = () => {
    if (!documents.length) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      documents: documents.map(createJsonPayload),
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `annotatex-dataset-${Date.now()}.json`,
    );
    toast.success("Exported full dataset (JSON)");
    setOpen(false);
  };

  const exportAllCsv = () => {
    if (!documents.length) return;
    const header = [
      "Document",
      "ID",
      "Start",
      "End",
      "Text",
      "Label",
      ...propertyColumns.map((property) => property.name),
    ];
    const rows = [header];
    documents.forEach((doc) => {
      doc.annotations.forEach((ann) => {
        rows.push([
          doc.name,
          ann.id,
          ann.start,
          ann.end,
          ann.text,
          ann.label,
          ...propertyColumns.map((property) => ann.metadata?.[property.id] ?? ""),
        ]);
      });
    });
    const csvContent = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
    downloadBlob(
      new Blob([csvContent], { type: "text/csv" }),
      `annotatex-dataset-${Date.now()}.csv`,
    );
    toast.success("Exported full dataset (CSV)");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="fixed bottom-6 left-6 shadow-lg z-20" size="lg">
          <Download className="w-5 h-5 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export annotations</DialogTitle>
          <DialogDescription>
            Export the current document or the entire dataset as JSON or CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground mb-2">Current document</p>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => exportDocumentJson(activeDocument)}
                disabled={!activeDocument}
              >
                <FileJson className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">JSON</div>
                  <div className="text-xs text-muted-foreground">
                    {activeDocument ? activeDocument.name : "No document selected"}
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => exportDocumentCsv(activeDocument)}
                disabled={!activeDocument}
              >
                <FileSpreadsheet className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">CSV</div>
                  <div className="text-xs text-muted-foreground">
                    Includes custom properties defined in your schema
                  </div>
                </div>
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase text-muted-foreground mb-2">All documents</p>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={exportAllJson}
                disabled={!documents.length}
              >
                <FileJson className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Dataset JSON</div>
                  <div className="text-xs text-muted-foreground">
                    Bundles every document, annotation, and relationship
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={exportAllCsv}
                disabled={!documents.length}
              >
                <FileSpreadsheet className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Dataset CSV</div>
                  <div className="text-xs text-muted-foreground">
                    Adds “Document” plus every custom property column
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

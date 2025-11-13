import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { DocumentRecord, DocumentType } from "@/types/document";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FileType,
  FileWarning,
  FolderOpen,
  ListChecks,
  Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";

interface DocumentToolbarProps {
  documents: DocumentRecord[];
  activeDocumentId: string | null;
  onSelectDocument: (documentId: string) => void;
  onPreviousDocument: () => void;
  onNextDocument: () => void;
  onTriggerDatasetPicker: () => void;
  isImporting: boolean;
}

const typeIconMap: Record<DocumentType, typeof FileText> = {
  txt: FileText,
  pdf: FileType,
  unknown: FileWarning,
};

const formatSize = (bytes: number) => {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
};

export const DocumentToolbar = ({
  documents,
  activeDocumentId,
  onSelectDocument,
  onPreviousDocument,
  onNextDocument,
  onTriggerDatasetPicker,
  isImporting,
}: DocumentToolbarProps) => {
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const activeDocument = documents.find((doc) => doc.id === activeDocumentId) ?? documents[0];
  const currentIndex = Math.max(
    documents.findIndex((doc) => doc.id === (activeDocument?.id ?? "")),
    documents.length ? 0 : -1,
  );

  const stats = useMemo(() => {
    const total = documents.length;
    const annotated = documents.filter((doc) => doc.annotations.length > 0 || doc.relationships.length > 0).length;
    const pdfCount = documents.filter((doc) => doc.type === "pdf").length;
    const txtCount = documents.filter((doc) => doc.type === "txt").length;
    const unknownCount = total - pdfCount - txtCount;
    return { total, annotated, pdfCount, txtCount, unknownCount };
  }, [documents]);

  const progressValue = stats.total === 0 ? 0 : (stats.annotated / stats.total) * 100;

  const TypeIcon = activeDocument ? typeIconMap[activeDocument.type] ?? FileText : FileText;

  return (
    <div className="border-b border-border bg-muted/30 px-4 py-3 flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-2 shrink-0 w-[96px] justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPreviousDocument}
            disabled={documents.length <= 1 || currentIndex <= 0}
            title="Previous document"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNextDocument}
            disabled={documents.length <= 1 || currentIndex === documents.length - 1}
            title="Next document"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card border border-border shadow-sm shrink-0">
            <TypeIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate max-w-[320px]" title={activeDocument?.name}>
              {activeDocument ? activeDocument.name : "Untitled Document"}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{activeDocument?.type ?? "txt"}</span>
              <span>·</span>
              <span>{formatSize(activeDocument?.size ?? 0)}</span>
              {documents.length > 1 && (
                <>
                  <span>·</span>
                  <span>
                    {currentIndex + 1}/{documents.length}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-[220px]">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>
            Progress {stats.total > 0 && `(${stats.annotated}/${stats.total})`}
          </span>
          {stats.total > 0 && <span>{Math.round(progressValue)}%</span>}
        </div>
        <Progress value={progressValue} />
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {stats.txtCount > 0 && <span>{stats.txtCount} txt</span>}
          {stats.pdfCount > 0 && <span>{stats.pdfCount} pdf</span>}
          {stats.unknownCount > 0 && <span>{stats.unknownCount} other</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onTriggerDatasetPicker} disabled={isImporting}>
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <FolderOpen className="mr-2 h-4 w-4" />
              Load dataset
            </>
          )}
        </Button>

        <Sheet open={isDrawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="outline">
              <ListChecks className="mr-2 h-4 w-4" />
              Documents
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[360px] sm:w-[420px]" side="left">
            <SheetHeader>
              <SheetTitle>Dataset</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-2 overflow-y-auto max-h-[80vh] pr-2">
              {documents.map((doc) => {
                const Icon = typeIconMap[doc.type] ?? FileText;
                const isActive = doc.id === activeDocumentId;
                return (
                  <button
                    key={doc.id}
                    onClick={() => {
                      onSelectDocument(doc.id);
                      setDrawerOpen(false);
                    }}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left transition hover:border-primary hover:bg-primary/5",
                      isActive ? "border-primary bg-primary/10" : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {doc.type} · {formatSize(doc.size)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {doc.annotations.length} ann / {doc.relationships.length} rel
                      </Badge>
                    </div>
                    {doc.status === "error" && (
                      <p className="mt-1 text-xs text-destructive">{doc.error}</p>
                    )}
                  </button>
                );
              })}
              {documents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No documents loaded. Use “Load dataset” to add txt/pdf files.
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

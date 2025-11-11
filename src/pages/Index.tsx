import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { DocumentToolbar } from "@/components/DocumentToolbar";
import { BrandBanner } from "@/components/BrandBanner";
import { TextEditor } from "@/components/TextEditor";
import { JsonViewer } from "@/components/JsonViewer";
import { SchemaPanel } from "@/components/SchemaPanel";
import { ExportDialog } from "@/components/ExportDialog";
import { AnnotationWorkbench } from "@/components/AnnotationWorkbench";
import { GraphPanel } from "@/components/GraphPanel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Annotation, Schema, Relationship, AnnotationMetadata } from "@/types/annotation";
import type { DocumentRecord, DocumentType } from "@/types/document";
import { toast } from "sonner";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker?url";

const SAMPLE_TEXT =
  "CHEST X-RAY (PA AND LATERAL)\n\nClinical History: 66-year-old with dyspnea; study extracted from MIMIC-CXR dataset.\n\nFindings:\n1. Patchy airspace opacities in the right mid and lower lung compatible with pneumonia.\n2. Mild cardiomegaly with prominent pulmonary vasculature.\n3. No pleural effusion or pneumothorax.\n\nImpression:\nRight lower-lobe consolidation consistent with infectious process. Recommend clinical correlation and short-term follow-up imaging.";

const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

const createSampleDocument = (): DocumentRecord => ({
  id: generateId(),
  name: "Sample Document",
  type: "txt",
  size: SAMPLE_TEXT.length,
  text: SAMPLE_TEXT,
  annotations: [],
  relationships: [],
  status: "ready",
  origin: "sample",
});

if (typeof window !== "undefined") {
  GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
}

const deriveDocumentType = (filename: string): DocumentType => {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "txt" || extension === "md") return "txt";
  if (extension === "pdf") return "pdf";
  return "unknown";
};

const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    text += `${pageText}\n`;
  }
  return text.trim();
};

const Index = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([createSampleDocument()]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(documents[0]?.id ?? null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [schema, setSchema] = useState<Schema>({
    labels: [
      {
        id: "lesion",
        name: "Lesion",
        color: "#FC683F",
        properties: [
          { id: "location", name: "Location", type: "text" },
          {
            id: "laterality",
            name: "Laterality",
            type: "select",
            options: ["left", "right", "midline"],
          },
          { id: "appearance", name: "Appearance", type: "text" },
        ],
      },
      {
        id: "finding",
        name: "Finding",
        color: "#8B5CF6",
        properties: [
          {
            id: "severity",
            name: "Severity",
            type: "select",
            options: ["mild", "moderate", "severe"],
          },
          { id: "impression", name: "Impression", type: "text" },
        ],
      },
      {
        id: "anatomy",
        name: "Anatomy",
        color: "#10B981",
        properties: [{ id: "structure", name: "Structure", type: "text" }],
      },
      {
        id: "clinical_history",
        name: "Clinical History",
        color: "#F59E0B",
        properties: [{ id: "symptom", name: "Symptom", type: "text" }],
      },
    ],
    relationTypes: [
      { id: "associated_with", name: "Associated With" },
      { id: "located_in", name: "Located In" },
      { id: "progression_of", name: "Progression Of" },
    ],
  });
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDocument = useMemo(
    () => documents.find((doc) => doc.id === activeDocumentId) ?? documents[0] ?? null,
    [documents, activeDocumentId],
  );

  useEffect(() => {
    if (!activeDocument && documents[0]) {
      setActiveDocumentId(documents[0].id);
    }
  }, [activeDocument, documents]);

  useEffect(() => {
    if (!activeDocument) {
      setSelectedAnnotationId(null);
      return;
    }
    if (selectedAnnotationId && !activeDocument.annotations.some((ann) => ann.id === selectedAnnotationId)) {
      setSelectedAnnotationId(null);
    }
  }, [activeDocument, selectedAnnotationId]);

  const mutateActiveDocument = useCallback(
    (updater: (doc: DocumentRecord) => DocumentRecord) => {
      if (!activeDocumentId) return;
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === activeDocumentId ? updater(doc) : doc)),
      );
    },
    [activeDocumentId],
  );

  const handleSetText = (nextText: string) => {
    mutateActiveDocument((doc) => ({ ...doc, text: nextText }));
  };

  const handleAddAnnotation = (annotation: Annotation) => {
    mutateActiveDocument((doc) => ({
      ...doc,
      annotations: [...doc.annotations, annotation],
    }));
    setSelectedAnnotationId(annotation.id);
  };

  const handleRemoveAnnotation = (id: string) => {
    mutateActiveDocument((doc) => ({
      ...doc,
      annotations: doc.annotations.filter((a) => a.id !== id),
      relationships: doc.relationships.filter((r) => r.source !== id && r.target !== id),
    }));
    setSelectedAnnotationId((prev) => (prev === id ? null : prev));
  };

  const handleUpdateAnnotationMetadata = (id: string, metadata: Partial<AnnotationMetadata>) => {
    mutateActiveDocument((doc) => ({
      ...doc,
      annotations: doc.annotations.map((annotation) =>
        annotation.id === id
          ? { ...annotation, metadata: { ...annotation.metadata, ...metadata } }
          : annotation,
      ),
    }));
  };

  const handleAddRelationship = (relationship: Relationship) => {
    mutateActiveDocument((doc) => ({
      ...doc,
      relationships: [...doc.relationships, relationship],
    }));
  };

  const handleRemoveRelationship = (id: string) => {
    mutateActiveDocument((doc) => ({
      ...doc,
      relationships: doc.relationships.filter((r) => r.id !== id),
    }));
  };

  const selectedAnnotation = useMemo(() => {
    if (!activeDocument) return null;
    return activeDocument.annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;
  }, [activeDocument, selectedAnnotationId]);

  const handleSelectDocument = useCallback((documentId: string) => {
    setActiveDocumentId(documentId);
  }, []);

  const handlePreviousDocument = useCallback(() => {
    if (!activeDocumentId) return;
    const index = documents.findIndex((doc) => doc.id === activeDocumentId);
    if (index > 0) {
      setActiveDocumentId(documents[index - 1].id);
    }
  }, [activeDocumentId, documents]);

  const handleNextDocument = useCallback(() => {
    if (!activeDocumentId) return;
    const index = documents.findIndex((doc) => doc.id === activeDocumentId);
    if (index >= 0 && index < documents.length - 1) {
      setActiveDocumentId(documents[index + 1].id);
    }
  }, [activeDocumentId, documents]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const isTyping =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable);
      if (isTyping) return;
      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        handleNextDocument();
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        handlePreviousDocument();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [handleNextDocument, handlePreviousDocument]);

  const handleTriggerDatasetPicker = () => {
    fileInputRef.current?.click();
  };

  const handleDatasetChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setIsImporting(true);
    try {
      const nextDocuments: DocumentRecord[] = [];

      for (const file of files) {
        const docType = deriveDocumentType(file.name);
        const name =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath?.length
            ? (file as File & { webkitRelativePath?: string }).webkitRelativePath
            : file.name;
        try {
          const text = docType === "pdf" ? await extractTextFromPdf(file) : await file.text();
          if (!text.trim()) {
            throw new Error("No extractable text");
          }
          nextDocuments.push({
            id: generateId(),
            name,
            type: docType,
            size: file.size,
            lastModified: file.lastModified,
            text,
            annotations: [],
            relationships: [],
            status: "ready",
            origin: "uploaded",
          });
        } catch (error) {
          nextDocuments.push({
            id: generateId(),
            name,
            type: docType,
            size: file.size,
            lastModified: file.lastModified,
            text: "",
            annotations: [],
            relationships: [],
            status: "error",
            error: error instanceof Error ? error.message : "Failed to process file",
            origin: "uploaded",
          });
        }
      }

      setDocuments((prev) => {
        const hasReadyDocs = nextDocuments.some((doc) => doc.status === "ready");
        const base = hasReadyDocs ? prev.filter((doc) => doc.origin !== "sample") : prev;
        return [...base, ...nextDocuments];
      });

      const firstReady = nextDocuments.find((doc) => doc.status === "ready");
      if (firstReady) {
        setActiveDocumentId(firstReady.id);
      }
      toast.success(`Loaded ${nextDocuments.length} document${nextDocuments.length === 1 ? "" : "s"}`);
    } finally {
      setIsImporting(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const annotations = activeDocument?.annotations ?? [];
  const relationships = activeDocument?.relationships ?? [];
  const text = activeDocument?.text ?? SAMPLE_TEXT;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <BrandBanner />
      <DocumentToolbar
        documents={documents}
        activeDocumentId={activeDocumentId}
        onSelectDocument={handleSelectDocument}
        onPreviousDocument={handlePreviousDocument}
        onNextDocument={handleNextDocument}
        onTriggerDatasetPicker={handleTriggerDatasetPicker}
        isImporting={isImporting}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".txt,.md,.pdf"
        onChange={handleDatasetChange}
        // @ts-expect-error - directory selection is not typed in React
        webkitdirectory=""
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1 border-t border-border">
        <ResizablePanel defaultSize={50} minSize={35} className="overflow-auto">
          <TextEditor
            text={text}
            setText={handleSetText}
            annotations={annotations}
            onAddAnnotation={handleAddAnnotation}
            onRemoveAnnotation={handleRemoveAnnotation}
            schema={schema}
            onAddRelationship={handleAddRelationship}
            selectedAnnotation={selectedAnnotation}
            selectedAnnotationId={selectedAnnotationId}
            onSelectAnnotation={setSelectedAnnotationId}
            onUpdateAnnotationMetadata={handleUpdateAnnotationMetadata}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={25} minSize={20} className="border-l border-border overflow-auto">
          <JsonViewer text={text} annotations={annotations} relationships={relationships} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={25} minSize={20} className="border-l border-border bg-muted/30 overflow-hidden">
          <Tabs defaultValue="schema" className="h-full flex flex-col">
            <div className="px-4 pt-4">
              <TabsList className="w-full">
                <TabsTrigger className="flex-1" value="schema">
                  Schema
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="workbench">
                  Workbench
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="graph">
                  Graph
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="schema" className="flex-1 overflow-hidden">
              <SchemaPanel schema={schema} onUpdateSchema={setSchema} />
            </TabsContent>
            <TabsContent value="workbench" className="flex-1 overflow-hidden">
              <AnnotationWorkbench
                annotations={annotations}
                selectedAnnotationId={selectedAnnotationId}
                onSelectAnnotation={setSelectedAnnotationId}
                onRemoveAnnotation={handleRemoveAnnotation}
                onUpdateMetadata={handleUpdateAnnotationMetadata}
                relationships={relationships}
                onRemoveRelationship={handleRemoveRelationship}
                schema={schema}
              />
            </TabsContent>
            <TabsContent value="graph" className="flex-1 overflow-hidden">
              <GraphPanel
                annotations={annotations}
                relationships={relationships}
                schema={schema}
                selectedAnnotationId={selectedAnnotationId}
                onSelectAnnotation={setSelectedAnnotationId}
                onAddRelationship={handleAddRelationship}
                onRemoveRelationship={handleRemoveRelationship}
              />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>

      <ExportDialog documents={documents} activeDocumentId={activeDocumentId} schema={schema} />
    </div>
  );
};

export default Index;

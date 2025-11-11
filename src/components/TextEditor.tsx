import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link as LinkIcon, Sparkles } from "lucide-react";
import type { Annotation, Schema, Relationship, AnnotationMetadata, LabelProperty } from "@/types/annotation";
import { toast } from "sonner";
import { FloatingLabelMenu } from "./FloatingLabelMenu";
import { cn } from "@/lib/utils";

interface TextEditorProps {
  text: string;
  setText: (text: string) => void;
  annotations: Annotation[];
  onAddAnnotation: (annotation: Annotation) => void;
  onRemoveAnnotation: (id: string) => void;
  schema: Schema;
  onAddRelationship: (relationship: Relationship) => void;
  selectedAnnotation: Annotation | null;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onUpdateAnnotationMetadata: (id: string, metadata: Partial<AnnotationMetadata>) => void;
}

export const TextEditor = ({
  text,
  setText,
  annotations,
  onAddAnnotation,
  onRemoveAnnotation,
  schema,
  onAddRelationship,
  selectedAnnotation,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateAnnotationMetadata,
}: TextEditorProps) => {
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [linkingMode, setLinkingMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<string>(schema.relationTypes[0]?.id ?? "related");
  const [isEditingSource, setIsEditingSource] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const selectedLabel = selectedAnnotation
    ? schema.labels.find((label) => label.id === selectedAnnotation.labelId)
    : null;
  const labelProperties = selectedLabel?.properties ?? [];

  const handleMetadataChange = (
    annotationId: string,
    propertyId: string,
    value: string | number | boolean | null | undefined,
  ) => {
    onUpdateAnnotationMetadata(annotationId, {
      [propertyId]: value,
    });
  };

  const renderPropertyControl = (property: LabelProperty) => {
    if (!selectedAnnotation) return null;
    const currentValue = selectedAnnotation.metadata?.[property.id];

    if (property.type === "select" && property.options && property.options.length > 0) {
      return (
        <Select
          value={typeof currentValue === "string" ? currentValue : ""}
          onValueChange={(value) => handleMetadataChange(selectedAnnotation.id, property.id, value)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Choose option" />
          </SelectTrigger>
          <SelectContent>
            {property.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    switch (property.type) {
      case "number":
        return (
          <Input
            type="number"
            value={currentValue ?? ""}
            onChange={(event) => {
              const val = event.target.value;
              handleMetadataChange(
                selectedAnnotation.id,
                property.id,
                val === "" ? undefined : Number(val),
              );
            }}
          />
        );
      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={Boolean(currentValue)}
              onCheckedChange={(checked) => handleMetadataChange(selectedAnnotation.id, property.id, checked)}
            />
            <span className="text-xs text-muted-foreground">{Boolean(currentValue) ? "Yes" : "No"}</span>
          </div>
        );
      default:
        return (
          <Input
            value={typeof currentValue === "string" ? currentValue : ""}
            onChange={(event) =>
              handleMetadataChange(selectedAnnotation.id, property.id, event.target.value)
            }
          />
        );
    }
  };

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.toString().trim().length === 0) {
        setSelection(null);
        setMenuPosition(null);
        return;
      }

      const selectedText = sel.toString();
      const range = sel.getRangeAt(0);

      if (!textRef.current?.contains(range.commonAncestorContainer)) {
        setSelection(null);
        setMenuPosition(null);
        return;
      }

      const offsets = calculateSelectionOffsets(range);
      if (!offsets) {
        setSelection(null);
        setMenuPosition(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      const coords = {
        x: rect.left + rect.width / 2 - 100,
        y: rect.bottom + window.scrollY + 10,
      };

      setSelection({ start: offsets.start, end: offsets.end, text: selectedText });
      setMenuPosition(coords);
    };

    document.addEventListener("selectionchange", handleSelection);
    return () => document.removeEventListener("selectionchange", handleSelection);
  }, []);

  useEffect(() => {
    if (!schema.relationTypes.length) return;
    setLinkType((current) => current || schema.relationTypes[0].id);
  }, [schema.relationTypes]);

  const isInExcludedNode = (node: Node | null) => {
    if (!node || node === textRef.current) return false;
    if (node instanceof Element && node.getAttribute("data-exclude-offset") === "true") {
      return true;
    }
    return isInExcludedNode(node.parentElement ?? (node.parentNode as Element | null));
  };

  const createTextWalker = () => {
    if (!textRef.current) return null;
    return document.createTreeWalker(
      textRef.current,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          return isInExcludedNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        },
      } as unknown as NodeFilter,
    );
  };

  const resolveToTextNode = (node: Node, offset: number, isStart: boolean): { node: Node; offset: number } => {
    if (node.nodeType === Node.TEXT_NODE) {
      return { node, offset };
    }

    const childNodes = Array.from(node.childNodes);
    if (childNodes.length > 0) {
      const childIndex = isStart ? Math.min(offset, childNodes.length - 1) : Math.max(Math.min(offset - 1, childNodes.length - 1), 0);
      const child = childNodes[childIndex];
      return resolveToTextNode(child, isStart ? 0 : child.textContent?.length ?? 0, isStart);
    }

    const sibling = isStart ? node.nextSibling : node.previousSibling;
    if (sibling) {
      return resolveToTextNode(sibling, isStart ? 0 : sibling.textContent?.length ?? 0, isStart);
    }

    const parent = node.parentNode;
    if (parent) {
      return resolveToTextNode(parent, offset, isStart);
    }

    return { node, offset: 0 };
  };

  const getOffsetForNode = (targetNode: Node, nodeOffset: number, isStart: boolean) => {
    const walker = createTextWalker();
    if (!walker) return null;

    const { node, offset: normalizedOffset } = resolveToTextNode(targetNode, nodeOffset, isStart);

    let offset = 0;
    let currentNode: Node | null = null;

    while ((currentNode = walker.nextNode())) {
      const length = currentNode.textContent?.length ?? 0;
      if (currentNode === node) {
        return offset + Math.min(normalizedOffset, length);
      }
      offset += length;
    }

    return null;
  };

  const calculateSelectionOffsets = (range: Range) => {
    if (!textRef.current) return null;

    const start = getOffsetForNode(range.startContainer, range.startOffset, true);
    const end = getOffsetForNode(range.endContainer, range.endOffset, false);

    if (start === null || end === null) {
      return null;
    }

    return { start, end };
  };

  const handleAddLabel = (labelId: string) => {
    if (!selection) return;

    const label = schema.labels.find((l) => l.id === labelId);
    if (!label) return;

    const metadata: AnnotationMetadata | undefined =
      label.properties && label.properties.length
        ? label.properties.reduce<AnnotationMetadata>((acc, property) => {
            switch (property.type) {
              case "boolean":
                acc[property.id] = false;
                break;
              case "number":
                acc[property.id] = null;
                break;
              case "select":
                acc[property.id] = property.options?.[0] ?? "";
                break;
              default:
                acc[property.id] = "";
            }
            return acc;
          }, {})
        : undefined;

    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      start: selection.start,
      end: selection.end,
      text: selection.text,
      labelId: label.id,
      label: label.name,
      color: label.color,
      metadata,
    };

    onAddAnnotation(newAnnotation);
    setSelection(null);
    setMenuPosition(null);
    onSelectAnnotation?.(newAnnotation.id);
    toast.success(`Added ${label.name} annotation`);
  };

  const handleCloseMenu = () => {
    setSelection(null);
    setMenuPosition(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleAnnotationClick = (annotation: Annotation, e: React.MouseEvent) => {
    e.stopPropagation();

    if (linkingMode && linkSource) {
      if (annotation.id === linkSource) {
        toast.info("Select a different annotation to create a relationship");
        return;
      }
      const newRelationship: Relationship = {
        id: `rel-${Date.now()}`,
        source: linkSource,
        target: annotation.id,
        type: linkType || schema.relationTypes[0]?.id || "related",
      };
      onAddRelationship(newRelationship);
      setLinkingMode(false);
      setLinkSource(null);
      toast.success("Relationship created");
    } else if (linkingMode) {
      setLinkSource(annotation.id);
      toast.info("Select target annotation");
    } else {
      onSelectAnnotation?.(annotation.id);
    }
  };

  const handleRemoveAnnotation = (annotation: Annotation, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    onRemoveAnnotation(annotation.id);
    toast.success(`Removed "${annotation.label}" annotation`);
  };

  const renderAnnotatedText = () => {
    if (annotations.length === 0) {
      return <span>{text}</span>;
    }

    const sortedAnnotations = [...annotations].sort((a, b) => a.start - b.start);
    const elements: JSX.Element[] = [];
    let currentIndex = 0;

    sortedAnnotations.forEach((annotation, idx) => {
      // Add text before annotation
      if (currentIndex < annotation.start) {
        elements.push(
          <span key={`text-${idx}`}>{text.substring(currentIndex, annotation.start)}</span>
        );
      }

      // Add annotation
      elements.push(
        <Badge
          key={annotation.id}
          variant="secondary"
          className={cn(
            "annotation-highlight cursor-pointer mx-0.5 group relative border",
            selectedAnnotationId === annotation.id && "ring-2 ring-primary/60",
          )}
          style={{
            backgroundColor: annotation.color + "20",
            borderColor: annotation.color,
            color: "inherit",
          }}
          onClick={(e) => handleAnnotationClick(annotation, e)}
          title="Click to select. Hover ✕ to remove."
        >
          {annotation.text}
          <span className="ml-1" data-exclude-offset="true">
            <span className="text-xs opacity-70 select-none">{annotation.label}</span>
          </span>
          <span
            data-exclude-offset="true"
            className="ml-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-destructive select-none"
            onClick={(e) => handleRemoveAnnotation(annotation, e)}
            title="Remove annotation"
          >
            ✕
          </span>
        </Badge>
      );

      currentIndex = annotation.end;
    });

    // Add remaining text
    if (currentIndex < text.length) {
      elements.push(<span key="text-end">{text.substring(currentIndex)}</span>);
    }

    return elements;
  };

  const handleAiAssist = () => {
    toast.info("AI Assist coming soon!", {
      description: "Auto-suggest labels based on context",
    });
  };

  const linkingDisabled = !schema.relationTypes.length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Text Annotation</h2>
          <p className="text-xs text-muted-foreground">Select spans to assign labels and enrich metadata.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center justify-end">
          <Button
            variant={isEditingSource ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditingSource((prev) => !prev)}
          >
            {isEditingSource ? "Lock Text" : "Edit Source"}
          </Button>
          {linkingMode && (
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase text-muted-foreground">Relationship type</span>
              <Select value={linkType} onValueChange={setLinkType}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Choose relation" />
                </SelectTrigger>
                <SelectContent>
                  {schema.relationTypes.map((relation) => (
                    <SelectItem key={relation.id} value={relation.id}>
                      {relation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const nextState = !linkingMode;
              setLinkingMode(nextState);
              if (!nextState) {
                setLinkSource(null);
              }
            }}
            disabled={linkingDisabled}
            className={cn(linkingMode && "bg-primary text-primary-foreground")}
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            {linkingMode ? "Cancel Linking" : "Link Annotations"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleAiAssist}>
            <Sparkles className="w-4 h-4 mr-2" />
            AI Assist
          </Button>
        </div>
      </div>

      {isEditingSource && (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-[140px]"
          />
          <p className="text-right text-xs text-muted-foreground">{text.length} characters</p>
        </div>
      )}

      <div className="text-sm text-muted-foreground mb-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-primary">✨</span>
          <div>
            <strong>Add:</strong> Simply select any text - a beautiful label menu appears!
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-destructive">✕</span>
          <div>
            <strong>Remove:</strong> Hover over annotation {"->"} click the <span className="text-destructive font-bold">✕</span>
          </div>
        </div>
      </div>

      {selectedAnnotation && labelProperties.length > 0 && (
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-4 space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">
              Properties · {selectedLabel?.name}
            </p>
            <p className="font-medium text-foreground line-clamp-2">{selectedAnnotation.text}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {labelProperties.map((property) => (
              <div key={property.id} className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground">{property.name}</Label>
                {renderPropertyControl(property)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        ref={textRef}
        className="min-h-[400px] p-6 bg-card border border-border rounded-lg leading-relaxed text-base cursor-text"
        style={{ userSelect: "text", WebkitUserSelect: "text", MozUserSelect: "text" }}
      >
        {renderAnnotatedText()}
      </div>

      <FloatingLabelMenu
        labels={schema.labels}
        position={menuPosition}
        onSelectLabel={handleAddLabel}
        onClose={handleCloseMenu}
      />
    </div>
  );
};

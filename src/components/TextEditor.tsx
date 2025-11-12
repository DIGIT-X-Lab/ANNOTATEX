import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Link as LinkIcon, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import type {
  Annotation,
  Schema,
  Relationship,
  AnnotationMetadata,
  LabelProperty,
  AnnotationSuggestion,
} from "@/types/annotation";
import { toast } from "sonner";
import { FloatingLabelMenu } from "./FloatingLabelMenu";
import { cn } from "@/lib/utils";
import { buildDefaultMetadata } from "@/lib/annotations";

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
  suggestions: AnnotationSuggestion[];
  assistEnabled: boolean;
  assistLoading: boolean;
  onToggleAssist: (enabled: boolean) => void;
  onAcceptSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
  onRefreshSuggestions: () => void;
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
  suggestions,
  assistEnabled,
  assistLoading,
  onToggleAssist,
  onAcceptSuggestion,
  onRejectSuggestion,
  onRefreshSuggestions,
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
  const pendingCount = suggestions.filter((suggestion) => suggestion.status === "pending").length;
  const visiblePendingSuggestions = assistEnabled
    ? suggestions.filter((suggestion) => suggestion.status === "pending")
    : [];
  const resolvedSuggestions = suggestions.length - pendingCount;
  const suggestionProgress = suggestions.length
    ? Math.round((resolvedSuggestions / suggestions.length) * 100)
    : 0;
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    if (a.status === b.status) {
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    }
    if (a.status === "pending") return -1;
    if (b.status === "pending") return 1;
    if (a.status === "accepted") return -1;
    if (b.status === "accepted") return 1;
    return 0;
  });

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
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>No</span>
            <Switch
              checked={Boolean(currentValue)}
              onCheckedChange={(checked) => handleMetadataChange(selectedAnnotation.id, property.id, checked)}
              aria-label={property.name}
            />
            <span>Yes</span>
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
        y: rect.bottom + 10,
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

    const metadata = buildDefaultMetadata(label);

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

  const renderAnnotationBadge = (annotation: Annotation) => (
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

  const renderSuggestionBadge = (suggestion: AnnotationSuggestion) => (
    <Badge
      key={suggestion.id}
      variant="secondary"
      className="annotation-highlight mx-0.5 group relative border border-dashed bg-transparent text-foreground/90"
      style={{
        borderColor: suggestion.color,
        backgroundColor: suggestion.color + "10",
      }}
    >
      {suggestion.text}
      <span className="ml-1" data-exclude-offset="true">
        <span className="text-[11px] uppercase tracking-wide opacity-70 select-none">
          Suggested · {suggestion.label}
        </span>
      </span>
      <span
        data-exclude-offset="true"
        className="ml-2 inline-flex items-center gap-1 select-none"
      >
        {suggestion.confidence && (
          <span className="text-[11px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded-full border border-border/60">
            {Math.round(suggestion.confidence * 100)}%
          </span>
        )}
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
          onClick={(event) => {
            event.stopPropagation();
            onAcceptSuggestion(suggestion.id);
          }}
          title="Accept suggestion"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
          onClick={(event) => {
            event.stopPropagation();
            onRejectSuggestion(suggestion.id);
          }}
          title="Dismiss suggestion"
        >
          <X className="w-3 h-3" />
        </button>
      </span>
    </Badge>
  );

  const renderAnnotatedText = () => {
    const spans = [
      ...annotations.map((annotation) => ({ ...annotation, kind: "annotation" as const })),
      ...visiblePendingSuggestions.map((suggestion) => ({ ...suggestion, kind: "suggestion" as const })),
    ].sort((a, b) => {
      if (a.start === b.start) {
        if (a.kind === b.kind) return 0;
        return a.kind === "annotation" ? -1 : 1;
      }
      return a.start - b.start;
    });

    if (spans.length === 0) {
      return <span>{text}</span>;
    }

    const elements: JSX.Element[] = [];
    let currentIndex = 0;

    spans.forEach((span, idx) => {
      if (currentIndex < span.start) {
        elements.push(
          <span key={`text-${idx}-${span.start}`}>{text.substring(currentIndex, span.start)}</span>
        );
      }

      elements.push(
        span.kind === "annotation"
          ? renderAnnotationBadge(span)
          : renderSuggestionBadge(span),
      );

      currentIndex = Math.max(currentIndex, span.end);
    });

    if (currentIndex < text.length) {
      elements.push(<span key="text-tail">{text.substring(currentIndex)}</span>);
    }

    return elements;
  };

  const totalSuggestions = suggestions.length;
  const linkingDisabled = !schema.relationTypes.length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Text Annotation</h2>
          <p className="text-xs text-muted-foreground">Select spans to assign labels and enrich metadata.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center justify-end">
          <div className="flex items-center gap-3 rounded-full border border-border/80 bg-background/80 px-4 py-2 shadow-sm">
            <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Assist Mode</p>
              <p className="text-sm font-medium">
                {assistEnabled
                  ? pendingCount
                    ? `${pendingCount} pending suggestion${pendingCount === 1 ? "" : "s"}`
                    : totalSuggestions
                      ? "All suggestions reviewed"
                      : assistLoading
                        ? "Fetching suggestions..."
                        : "Ready for hints"
                  : "Off · Enable to preview model hints"}
              </p>
            </div>
            <Switch checked={assistEnabled} onCheckedChange={onToggleAssist} aria-label="Toggle assist mode" />
          </div>
          {assistEnabled && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefreshSuggestions}
                disabled={assistLoading}
                className="min-w-[120px]"
              >
                {assistLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {assistLoading ? "Fetching..." : "Refresh"}
              </Button>
            </>
          )}
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

      <div className={cn("grid gap-6", assistEnabled ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "")}>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
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
        </div>

        {assistEnabled && (
          <aside className="rounded-2xl border border-border/80 bg-gradient-to-b from-background/80 to-muted/70 backdrop-blur-xl p-4 shadow-[0_30px_70px_rgba(15,23,42,0.25)] space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">Review queue</p>
                <p className="text-sm font-semibold">
                  {pendingCount
                    ? `${pendingCount} pending`
                    : totalSuggestions
                      ? "All caught up"
                      : assistLoading
                        ? "Fetching suggestions..."
                        : "No suggestions yet"}
                </p>
              </div>
              <Badge variant="secondary" className="uppercase tracking-wide text-[11px]">
                {resolvedSuggestions}/{totalSuggestions || 0} reviewed
              </Badge>
            </div>
            <Progress value={suggestionProgress} className="h-2" />
            {totalSuggestions === 0 && !assistLoading ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-6 text-center text-sm text-muted-foreground space-y-2">
                <Sparkles className="w-5 h-5 text-primary mx-auto" />
                <p>Run the assist engine to preload smart suggestions.</p>
                <p className="text-xs">Use the refresh button above anytime.</p>
              </div>
            ) : (
              <ScrollArea className="h-[360px] pr-3">
                <div className="space-y-3">
                  {sortedSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className={cn(
                        "rounded-xl border p-3 text-sm space-y-2 transition-all",
                        suggestion.status === "pending"
                          ? "border-primary/30 bg-primary/5"
                          : suggestion.status === "accepted"
                            ? "border-emerald-300/60 bg-emerald-50/60 text-emerald-900 dark:text-emerald-100 dark:bg-emerald-500/10"
                            : "border-border/80 bg-background/60 opacity-70",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {suggestion.label}
                          </p>
                          <p className="font-medium line-clamp-3">{suggestion.text}</p>
                        </div>
                        {suggestion.confidence && (
                          <span className="text-xs font-semibold text-muted-foreground">
                            {Math.round(suggestion.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{suggestion.source ?? "Assist"}</span>
                        <span className="capitalize">{suggestion.status}</span>
                      </div>
                      {suggestion.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-8 flex-1"
                            onClick={() => onAcceptSuggestion(suggestion.id)}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 flex-1"
                            onClick={() => onRejectSuggestion(suggestion.id)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </aside>
        )}
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

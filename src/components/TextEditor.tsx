import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, Sparkles } from "lucide-react";
import type { Annotation, Schema, Relationship } from "@/types/annotation";
import { toast } from "sonner";
import { FloatingLabelMenu } from "./FloatingLabelMenu";

interface TextEditorProps {
  text: string;
  setText: (text: string) => void;
  annotations: Annotation[];
  onAddAnnotation: (annotation: Annotation) => void;
  onRemoveAnnotation: (id: string) => void;
  schema: Schema;
  relationships: Relationship[];
  onAddRelationship: (relationship: Relationship) => void;
  onRemoveRelationship: (id: string) => void;
}

export const TextEditor = ({
  text,
  setText,
  annotations,
  onAddAnnotation,
  onRemoveAnnotation,
  schema,
  relationships,
  onAddRelationship,
}: TextEditorProps) => {
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [linkingMode, setLinkingMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const getSelectionCoordinates = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    return {
      x: rect.left + rect.width / 2 - 100, // Center the menu
      y: rect.bottom + window.scrollY + 10, // Position below selection
    };
  };

  const getTextOffset = (node: Node, offset: number): number => {
    let textOffset = 0;
    const walker = document.createTreeWalker(
      textRef.current!,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentNode;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === node) {
        return textOffset + offset;
      }
      textOffset += currentNode.textContent?.length || 0;
    }
    return textOffset;
  };

  const handleTextSelect = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      const selectedText = sel.toString();
      const range = sel.getRangeAt(0);
      const start = getTextOffset(range.startContainer, range.startOffset);
      const end = start + selectedText.length;
      const coords = getSelectionCoordinates();
      
      if (coords) {
        setSelection({ start, end, text: selectedText });
        setMenuPosition(coords);
      }
    }
  };

  const handleAddLabel = (labelId: string) => {
    if (!selection) return;

    const label = schema.labels.find((l) => l.id === labelId);
    if (!label) return;

    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      start: selection.start,
      end: selection.end,
      text: selection.text,
      label: label.name,
      color: label.color,
    };

    onAddAnnotation(newAnnotation);
    setSelection(null);
    setMenuPosition(null);
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
      // Create relationship
      const newRelationship: Relationship = {
        id: `rel-${Date.now()}`,
        source: linkSource,
        target: annotation.id,
        type: schema.relationTypes[0]?.id || "related",
      };
      onAddRelationship(newRelationship);
      setLinkingMode(false);
      setLinkSource(null);
      toast.success("Relationship created");
    } else if (linkingMode) {
      setLinkSource(annotation.id);
      toast.info("Select target annotation");
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
          className="annotation-highlight cursor-pointer mx-0.5 group relative"
          style={{
            backgroundColor: annotation.color + "20",
            borderColor: annotation.color,
            borderWidth: "1px",
            color: "inherit",
          }}
          onClick={(e) => handleAnnotationClick(annotation, e)}
          title="Click ✕ to remove"
        >
          {annotation.text}
          <span className="ml-1 text-xs opacity-70">{annotation.label}</span>
          <span 
            className="ml-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-destructive"
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Text Annotation</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLinkingMode(!linkingMode);
              setLinkSource(null);
            }}
            className={linkingMode ? "bg-primary text-primary-foreground" : ""}
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
            <strong>Remove:</strong> Hover over annotation → click the <span className="text-destructive font-bold">✕</span>
          </div>
        </div>
      </div>

      <div
        ref={textRef}
        className="min-h-[400px] p-6 bg-card border border-border rounded-lg leading-relaxed text-base"
        onMouseUp={handleTextSelect}
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

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Annotation, AnnotationMetadata, Relationship, Schema, LabelProperty } from "@/types/annotation";
import { Trash2, X } from "lucide-react";

interface AnnotationWorkbenchProps {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onRemoveAnnotation: (id: string) => void;
  onUpdateMetadata: (id: string, metadata: Partial<AnnotationMetadata>) => void;
  relationships: Relationship[];
  onRemoveRelationship: (id: string) => void;
  schema: Schema;
}

export const AnnotationWorkbench = ({
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onRemoveAnnotation,
  onUpdateMetadata,
  relationships,
  onRemoveRelationship,
  schema,
}: AnnotationWorkbenchProps) => {
  const selectedAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null,
    [annotations, selectedAnnotationId],
  );

  const selectedLabel = useMemo(
    () => schema.labels.find((label) => label.id === selectedAnnotation?.labelId),
    [schema.labels, selectedAnnotation?.labelId],
  );
  const labelProperties = selectedLabel?.properties ?? [];

  const handleMetadataChange = (
    annotationId: string,
    propertyId: string,
    value: string | number | boolean | null | undefined,
  ) => {
    onUpdateMetadata(annotationId, { [propertyId]: value });
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
          <SelectTrigger>
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

  const relatedRelationships = useMemo(() => {
    if (!selectedAnnotation) return [];
    return relationships.filter(
      (relationship) =>
        relationship.source === selectedAnnotation.id || relationship.target === selectedAnnotation.id,
    );
  }, [relationships, selectedAnnotation]);

  const handleClearRelationships = () => {
    relationships.forEach((relationship) => onRemoveRelationship(relationship.id));
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Card className="flex-1 overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">Annotations</p>
              <p className="text-xs text-muted-foreground/70">Select a span to enrich it with metadata</p>
            </div>
            {selectedAnnotation && (
              <Button variant="ghost" size="icon" onClick={() => onSelectAnnotation(null)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid h-full grid-cols-5">
          <div className="col-span-2 border-r border-border">
            <ScrollArea className="h-full">
              <div className="space-y-3 p-4">
                {annotations.length === 0 && (
                  <p className="text-xs text-muted-foreground">No annotations yet. Highlight text to get started.</p>
                )}

                {annotations.map((annotation) => (
                  <button
                    key={annotation.id}
                    onClick={() =>
                      onSelectAnnotation(selectedAnnotationId === annotation.id ? null : annotation.id)
                    }
                    className={cn(
                      "w-full rounded-lg border px-3 py-3 text-left transition hover:border-primary hover:bg-primary/5",
                      selectedAnnotationId === annotation.id ? "border-primary bg-primary/10" : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge style={{ backgroundColor: annotation.color + "20", borderColor: annotation.color }}>
                        {annotation.label}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemoveAnnotation(annotation.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    <p className="mt-2 text-sm text-foreground">{annotation.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {annotation.start} {"->"} {annotation.end}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="col-span-3 flex flex-col">
            {!selectedAnnotation ? (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                Select an annotation to edit metadata.
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-5 p-5">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Focused Annotation</p>
                    <p className="mt-1 text-lg font-semibold leading-tight">{selectedAnnotation.text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: selectedAnnotation.color,
                          color: selectedAnnotation.color,
                        }}
                      >
                        {selectedAnnotation.label}
                      </Badge>
                      <span>
                        Span {selectedAnnotation.start} {"->"} {selectedAnnotation.end}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Properties
                    </Label>
                    {labelProperties.length > 0 ? (
                      <div className="space-y-3">
                        {labelProperties.map((property) => (
                          <div key={property.id} className="space-y-1">
                            <p className="text-xs text-muted-foreground">{property.name}</p>
                            {renderPropertyControl(property)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No custom properties for {selectedLabel?.name ?? "this label"}.
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase text-muted-foreground">Relationships</p>
                      <p className="text-xs text-muted-foreground">{relatedRelationships.length} linked</p>
                    </div>

                    {relatedRelationships.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No relationships yet. Use “Link Annotations” in the editor to connect entities.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {relatedRelationships.map((relationship) => {
                          const targetId =
                            relationship.source === selectedAnnotation.id
                              ? relationship.target
                              : relationship.source;
                          const targetAnnotation =
                            annotations.find((item) => item.id === targetId) ?? null;
                          const relationLabel =
                            schema.relationTypes.find((rel) => rel.id === relationship.type)?.name ??
                            relationship.type;
                          return (
                            <div
                              key={relationship.id}
                              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                            >
                              <div>
                                <p className="font-medium">{relationLabel}</p>
                                <p className="text-xs text-muted-foreground">
                                  {"->"} {targetAnnotation ? targetAnnotation.text : "Unknown entity"}
                                </p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onRemoveRelationship(relationship.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Relationship Graph</p>
            <p className="text-xs text-muted-foreground">
              {relationships.length === 0
                ? "Link annotations to see structure emerge."
                : `${relationships.length} active relationship${relationships.length > 1 ? "s" : ""}.`}
            </p>
          </div>
          {relationships.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearRelationships}
            >
              Clear all
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

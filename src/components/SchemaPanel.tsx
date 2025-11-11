import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Schema, Label as SchemaLabel, RelationType } from "@/types/annotation";
import { toast } from "sonner";
import { SchemaImportDrawer } from "@/components/SchemaImportDrawer";

const COLOR_PALETTE = [
  "#00B8D9",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#F97316",
  "#6366F1",
  "#EC4899",
  "#84CC16",
  "#06B6D4",
  "#EF4444",
  "#A855F7",
  "#0EA5E9",
];

const normalizeColor = (color: string) => color.trim().toLowerCase();

const hslToHex = (h: number, s: number, l: number) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const getNextColor = (labels: SchemaLabel[]) => {
  const used = new Set(labels.map((label) => normalizeColor(label.color)));
  const available = COLOR_PALETTE.find((color) => !used.has(normalizeColor(color)));
  if (available) return available;
  const hue = (labels.length * 47) % 360;
  return hslToHex(hue, 0.65, 0.55);
};

interface SchemaPanelProps {
  schema: Schema;
  onUpdateSchema: (schema: Schema) => void;
}

export const SchemaPanel = ({ schema, onUpdateSchema }: SchemaPanelProps) => {
  const [newLabelName, setNewLabelName] = useState("");
  const derivedColor = useMemo(() => getNextColor(schema.labels), [schema.labels]);
  const [newLabelColor, setNewLabelColor] = useState(derivedColor);
  const [newRelationType, setNewRelationType] = useState("");
  const [propertyInputs, setPropertyInputs] = useState<Record<string, string>>({});
  const [importKey, setImportKey] = useState(0);

  useEffect(() => {
    setNewLabelColor(derivedColor);
  }, [derivedColor]);

  const handleImportSchema = (incoming: Schema, importMode: "replace" | "merge") => {
    if (importMode === "replace") {
      onUpdateSchema({
        labels: incoming.labels ?? [],
        relationTypes: incoming.relationTypes ?? [],
      });
      setImportKey((prev) => prev + 1);
      toast.success("Schema replaced");
      return;
    }

    const labelMap = new Map<string, SchemaLabel>();
    schema.labels.forEach((label) => labelMap.set(label.id, label));
    incoming.labels?.forEach((label) => labelMap.set(label.id, label));

    const relationMap = new Map<string, RelationType>();
    schema.relationTypes.forEach((relation) => relationMap.set(relation.id, relation));
    incoming.relationTypes?.forEach((relation) => relationMap.set(relation.id, relation));

    onUpdateSchema({
      labels: Array.from(labelMap.values()),
      relationTypes: Array.from(relationMap.values()),
    });
    toast.success("Schema merged");
  };

  const handleAddLabel = () => {
    if (!newLabelName.trim()) {
      toast.error("Label name is required");
      return;
    }

    const newLabel: SchemaLabel = {
      id: newLabelName.toLowerCase().replace(/\s+/g, "_"),
      name: newLabelName,
      color: newLabelColor,
      properties: [],
    };

    const updatedLabels = [...schema.labels, newLabel];
    onUpdateSchema({
      ...schema,
      labels: updatedLabels,
    });

    setNewLabelName("");
    setNewLabelColor(getNextColor(updatedLabels));
    toast.success("Label added");
  };

  const handleRemoveLabel = (id: string) => {
    onUpdateSchema({
      ...schema,
      labels: schema.labels.filter((l) => l.id !== id),
    });
    toast.success("Label removed");
  };

  const handleAddProperty = (labelId: string) => {
    const inputValue = propertyInputs[labelId]?.trim();
    if (!inputValue) {
      toast.error("Property name is required");
      return;
    }

    const normalizedId = inputValue.toLowerCase().replace(/\s+/g, "_");
    const targetLabel = schema.labels.find((label) => label.id === labelId);
    const alreadyExists = targetLabel?.properties?.some((prop) => prop.id === normalizedId);
    if (alreadyExists) {
      toast.error("Property with this name already exists");
      return;
    }

    const labels = schema.labels.map((label) =>
      label.id === labelId
        ? {
            ...label,
            properties: [
              ...(label.properties ?? []),
              {
                id: normalizedId,
                name: inputValue,
                type: "text" as const,
              },
            ],
          }
        : label,
    );

    onUpdateSchema({ ...schema, labels });
    setPropertyInputs((prev) => ({ ...prev, [labelId]: "" }));
    toast.success("Property added");
  };

  const handleRemoveProperty = (labelId: string, propertyId: string) => {
    const labels = schema.labels.map((label) =>
      label.id === labelId
        ? {
            ...label,
            properties: (label.properties ?? []).filter((prop) => prop.id !== propertyId),
          }
        : label,
    );
    onUpdateSchema({ ...schema, labels });
    toast.success("Property removed");
  };

  const handleAddRelationType = () => {
    if (!newRelationType.trim()) {
      toast.error("Relation type is required");
      return;
    }

    const newRelation: RelationType = {
      id: newRelationType.toLowerCase().replace(/\s+/g, "_"),
      name: newRelationType,
    };

    onUpdateSchema({
      ...schema,
      relationTypes: [...schema.relationTypes, newRelation],
    });

    setNewRelationType("");
    toast.success("Relation type added");
  };

  const handleRemoveRelationType = (id: string) => {
    onUpdateSchema({
      ...schema,
      relationTypes: schema.relationTypes.filter((r) => r.id !== id),
    });
    toast.success("Relation type removed");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Schema</h2>
          <p className="text-sm text-muted-foreground mt-1">Define your annotation ontology</p>
        </div>
        <SchemaImportDrawer key={importKey} currentSchema={schema} onApply={handleImportSchema} />
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Labels Section */}
          <Card className="p-4 space-y-4">
            <h3 className="font-medium text-sm">Entity Labels</h3>

            <div className="space-y-3">
              {schema.labels.map((label) => (
                <div key={label.id} className="rounded-lg border border-border/70 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 border border-white/30"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="text-sm font-semibold">{label.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemoveLabel(label.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Properties</Label>
                    {label.properties && label.properties.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {label.properties.map((property) => (
                          <span
                            key={property.id}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs"
                          >
                            {property.name}
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveProperty(label.id, property.id)}
                              aria-label={`Remove ${property.name}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No properties defined yet.</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Add property (e.g. Location)"
                      value={propertyInputs[label.id] ?? ""}
                      onChange={(e) =>
                        setPropertyInputs((prev) => ({ ...prev, [label.id]: e.target.value }))
                      }
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddProperty(label.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs">Add New Label</Label>
                <Input
                  placeholder="Label name"
                  value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                    className="h-8 w-16 p-1"
                    title="Label color"
                  />
                  <span className="text-xs text-muted-foreground">{newLabelColor.toUpperCase()}</span>
                </div>
                <Button size="sm" onClick={handleAddLabel} className="flex-1">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Label
                </Button>
              </div>
            </div>
          </Card>

          {/* Relation Types Section */}
          <Card className="p-4 space-y-4">
            <h3 className="font-medium text-sm">Relation Types</h3>

            <div className="space-y-2">
              {schema.relationTypes.map((relType) => (
                <div key={relType.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50">
                  <span className="flex-1 text-sm">{relType.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRemoveRelationType(relType.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs">Add Relation Type</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Relation name"
                  value={newRelationType}
                  onChange={(e) => setNewRelationType(e.target.value)}
                  className="h-8 text-sm flex-1"
                />
                <Button size="sm" onClick={handleAddRelationType}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};

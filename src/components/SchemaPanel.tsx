import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Schema, Label as SchemaLabel, RelationType } from "@/types/annotation";
import { toast } from "sonner";

interface SchemaPanelProps {
  schema: Schema;
  onUpdateSchema: (schema: Schema) => void;
}

export const SchemaPanel = ({ schema, onUpdateSchema }: SchemaPanelProps) => {
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#00B8D9");
  const [newRelationType, setNewRelationType] = useState("");

  const handleAddLabel = () => {
    if (!newLabelName.trim()) {
      toast.error("Label name is required");
      return;
    }

    const newLabel: SchemaLabel = {
      id: newLabelName.toLowerCase().replace(/\s+/g, "_"),
      name: newLabelName,
      color: newLabelColor,
    };

    onUpdateSchema({
      ...schema,
      labels: [...schema.labels, newLabel],
    });

    setNewLabelName("");
    setNewLabelColor("#00B8D9");
    toast.success("Label added");
  };

  const handleRemoveLabel = (id: string) => {
    onUpdateSchema({
      ...schema,
      labels: schema.labels.filter((l) => l.id !== id),
    });
    toast.success("Label removed");
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
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Schema</h2>
        <p className="text-sm text-muted-foreground mt-1">Define your annotation ontology</p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Labels Section */}
          <Card className="p-4 space-y-4">
            <h3 className="font-medium text-sm">Entity Labels</h3>

            <div className="space-y-2">
              {schema.labels.map((label) => (
                <div key={label.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1 text-sm">{label.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRemoveLabel(label.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
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
                <Input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="h-8 w-16 p-1"
                />
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

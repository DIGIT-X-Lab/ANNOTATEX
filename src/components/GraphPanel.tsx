import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Connection,
  ConnectionMode,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  NodeDragHandler,
  OnEdgesDeleteFunc,
  OnNodeClick,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import type { Annotation, Relationship, Schema } from "@/types/annotation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface GraphPanelProps {
  annotations: Annotation[];
  relationships: Relationship[];
  schema: Schema;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onAddRelationship: (relationship: Relationship) => void;
  onRemoveRelationship: (id: string) => void;
}

type PendingDirection = "forward" | "reverse";

export const GraphPanel = ({
  annotations,
  relationships,
  schema,
  selectedAnnotationId,
  onSelectAnnotation,
  onAddRelationship,
  onRemoveRelationship,
}: GraphPanelProps) => {
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [pendingDirection, setPendingDirection] = useState<PendingDirection>("forward");
  const [pendingRelationType, setPendingRelationType] = useState(schema.relationTypes[0]?.id ?? "");
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  const relationTypeFallback = schema.relationTypes[0]?.id ?? "";

  useEffect(() => {
    setPendingRelationType((current) => {
      if (!current || !schema.relationTypes.find((rel) => rel.id === current)) {
        return relationTypeFallback;
      }
      return current;
    });
  }, [relationTypeFallback, schema.relationTypes]);

  useEffect(() => {
    setNodePositions((prev) => {
      const updated: typeof prev = {};
      annotations.forEach((annotation) => {
        if (prev[annotation.id]) {
          updated[annotation.id] = prev[annotation.id];
        }
      });
      return updated;
    });
  }, [annotations]);

  const ensureRelationType = useCallback(() => {
    if (!pendingRelationType || !schema.relationTypes.find((rel) => rel.id === pendingRelationType)) {
      setPendingRelationType(relationTypeFallback);
    }
  }, [pendingRelationType, schema.relationTypes, relationTypeFallback]);

  const nodes = useMemo<Node[]>(
    () =>
      annotations.map((annotation, index) => {
        const columnCount = Math.max(1, Math.ceil(Math.sqrt(annotations.length)));
        const column = index % columnCount;
        const row = Math.floor(index / columnCount);
        const fallbackPosition = { x: column * 220, y: row * 140 };
        const position = nodePositions[annotation.id] ?? fallbackPosition;

        const labelDefinition = schema.labels.find((label) => label.id === annotation.labelId);
        const properties = labelDefinition?.properties ?? [];
        const metadataPairs =
          properties
            .map((property) => {
              const value = annotation.metadata?.[property.id];
              return value ? { name: property.name, value: String(value) } : null;
            })
            .filter(Boolean) ?? [];

        return {
          id: annotation.id,
          data: {
            label: (
              <div className="text-xs">
                <p className="font-semibold truncate">{annotation.text}</p>
                <div className="mt-1 flex flex-wrap gap-1 items-center">
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: annotation.color,
                      color: annotation.color,
                    }}
                  >
                    {annotation.label}
                  </Badge>
                </div>
                {metadataPairs.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {metadataPairs.slice(0, 2).map(
                      (pair) =>
                        pair && (
                          <p key={pair.name} className="text-[10px] text-muted-foreground truncate">
                            <span className="font-medium">{pair.name}:</span> {pair.value}
                          </p>
                        ),
                    )}
                  </div>
                )}
              </div>
            ),
          },
          position,
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          style: {
            border: `2px solid ${annotation.color}`,
            borderRadius: 12,
            padding: 12,
            background: "var(--card)",
            boxShadow: selectedAnnotationId === annotation.id ? "0 0 0 2px rgba(0,184,217,0.2)" : undefined,
          },
          draggable: true,
        };
      }),
    [annotations, nodePositions, selectedAnnotationId, schema.labels],
  );

  const edges = useMemo<Edge[]>(
    () =>
      relationships.map((relationship) => {
        const relationLabel =
          schema.relationTypes.find((relType) => relType.id === relationship.type)?.name ?? relationship.type;
        return {
          id: relationship.id,
          source: relationship.source,
          target: relationship.target,
          label: relationLabel,
          type: "smoothstep",
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: "hsl(var(--primary))",
          },
          style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          labelBgPadding: [6, 2],
          labelBgBorderRadius: 4,
          labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.9 },
          labelStyle: { fontSize: 12, fill: "hsl(var(--foreground))" },
        };
      }),
    [relationships, schema.relationTypes],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) {
        toast.info("Choose a different node to create a relationship.");
        return;
      }
      setPendingConnection(connection);
      setPendingDirection("forward");
      ensureRelationType();
    },
    [ensureRelationType],
  );

  const handleNodeClick: OnNodeClick = (_, node) => {
    onSelectAnnotation(node.id);
  };

  const handleNodeDragStop: NodeDragHandler = (_, node) => {
    setNodePositions((prev) => ({
      ...prev,
      [node.id]: node.position,
    }));
  };

  const handleEdgesDelete: OnEdgesDeleteFunc = (deletedEdges) => {
    deletedEdges.forEach((edge) => onRemoveRelationship(edge.id));
  };

  const finalizeConnection = () => {
    if (!pendingConnection) return;
    const chosenType = pendingRelationType || relationTypeFallback;
    if (!chosenType) {
      toast.error("Define at least one relation type in the schema panel.");
      return;
    }

    const { source, target } = pendingConnection;
    if (!source || !target) return;

    const [finalSource, finalTarget] =
      pendingDirection === "forward" ? [source, target] : [target, source];

    const newRelationship: Relationship = {
      id: `rel-${Date.now()}`,
      source: finalSource,
      target: finalTarget,
      type: chosenType,
    };

    onAddRelationship(newRelationship);
    setPendingConnection(null);
  };

  const cancelConnection = () => {
    setPendingConnection(null);
  };

  const selectedSourceAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === pendingConnection?.source),
    [annotations, pendingConnection?.source],
  );

  const selectedTargetAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === pendingConnection?.target),
    [annotations, pendingConnection?.target],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Relationship Graph</h3>
            <p className="text-xs text-muted-foreground">
              Drag from one node handle to another to propose a relationship.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {relationships.length} relationship{relationships.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="flex-1">
        {annotations.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground px-6 text-center">
            Create annotations from the text editor to populate the graph. Nodes appear here automatically.
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            onConnect={handleConnect}
            onNodeClick={handleNodeClick}
            onNodeDragStop={handleNodeDragStop}
            onEdgesDelete={handleEdgesDelete}
            snapToGrid
            snapGrid={[20, 20]}
            panOnDrag
            panOnScroll
            zoomOnScroll
            zoomOnDoubleClick={false}
            connectionMode={ConnectionMode.Loose}
            connectionLineStyle={{ stroke: "hsl(var(--primary))", strokeWidth: 2, opacity: 0.8 }}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))", width: 16, height: 16 },
              style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
            }}
            proOptions={{ hideAttribution: true }}
            className="bg-muted/30"
          >
            <Background gap={16} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => (typeof node?.style?.borderColor === "string" ? (node.style.borderColor as string) : "hsl(var(--primary))")}
            />
            <Controls />
          </ReactFlow>
        )}
      </div>

      <Dialog open={Boolean(pendingConnection)} onOpenChange={(open) => !open && cancelConnection()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Relationship</DialogTitle>
            <DialogDescription>
              Choose the direction and type for this connection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <p className="text-xs uppercase text-muted-foreground">Nodes</p>
              <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
                <p>
                  Source candidate: <strong>{selectedSourceAnnotation?.text ?? "Unknown"}</strong>
                </p>
                <p>
                  Target candidate: <strong>{selectedTargetAnnotation?.text ?? "Unknown"}</strong>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase text-muted-foreground">Direction</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={pendingDirection === "forward" ? "default" : "outline"}
                  onClick={() => setPendingDirection("forward")}
                  className="flex-1"
                >
                  Source {"->"} Target
                </Button>
                <Button
                  type="button"
                  variant={pendingDirection === "reverse" ? "default" : "outline"}
                  onClick={() => setPendingDirection("reverse")}
                  className="flex-1"
                >
                  Target {"->"} Source
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase text-muted-foreground">Relation Type</p>
              <Select
                value={pendingRelationType}
                onValueChange={setPendingRelationType}
                disabled={!schema.relationTypes.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {schema.relationTypes.map((relType) => (
                    <SelectItem key={relType.id} value={relType.id}>
                      {relType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!schema.relationTypes.length && (
                <p className="text-xs text-muted-foreground">
                  Add relation types in the Schema tab before creating edges.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={cancelConnection}>
                Cancel
              </Button>
              <Button onClick={finalizeConnection} disabled={!schema.relationTypes.length}>
                Create Relationship
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

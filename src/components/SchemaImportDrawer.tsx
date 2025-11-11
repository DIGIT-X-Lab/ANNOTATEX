import { useEffect, useMemo, useRef, useState } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Schema } from "@/types/annotation";

interface SchemaImportDrawerProps {
  currentSchema: Schema;
  onApply: (schema: Schema, mode: "replace" | "merge") => void;
}

const TEMPLATES = [
  {
    name: "Radiology Sample",
    description: "Lesions, findings, anatomy",
    url: "/templates/radiology.json",
  },
];

export const SchemaImportDrawer = ({ currentSchema, onApply }: SchemaImportDrawerProps) => {
  const [open, setOpen] = useState(false);
  const [rawInput, setRawInput] = useState(() => JSON.stringify(currentSchema, null, 2));
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [parsedSchema, setParsedSchema] = useState<Schema | null>(currentSchema);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewStats = useMemo(() => {
    if (!parsedSchema) return null;
    return {
      labelCount: parsedSchema.labels.length,
      propertyCount: parsedSchema.labels.reduce((acc, label) => acc + (label.properties?.length ?? 0), 0),
      relationCount: parsedSchema.relationTypes.length,
    };
  }, [parsedSchema]);

  const parseInput = (input: string) => {
    try {
      const json = JSON.parse(input);
      if (!json || typeof json !== "object") {
        throw new Error("Schema must be an object");
      }
      const schema: Schema = {
        labels: json.labels ?? [],
        relationTypes: json.relationTypes ?? [],
      };
      setParsedSchema(schema);
      setError(null);
    } catch (err) {
      setParsedSchema(null);
      setError(err instanceof Error ? err.message : "Invalid schema");
    }
  };

  const handleTextareaChange = (value: string) => {
    setRawInput(value);
    parseInput(value);
  };

  useEffect(() => {
    if (open) {
      const fresh = JSON.stringify(currentSchema, null, 2);
      setRawInput(fresh);
      parseInput(fresh);
      setMode("replace");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentSchema]);

  const handleTemplateLoad = async (templateUrl: string) => {
    try {
      setIsLoadingTemplate(true);
      const res = await fetch(templateUrl);
      if (!res.ok) {
        throw new Error("Unable to load template");
      }
      const text = await res.text();
      setRawInput(text);
      parseInput(text);
      toast.success("Template loaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load template");
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  const handleApply = () => {
    if (!parsedSchema) {
      toast.error("Provide a valid schema before applying");
      return;
    }
    onApply(parsedSchema, mode);
    setOpen(false);
    toast.success(`Schema imported (${parsedSchema.labels.length} labels)`);
  };

  const handleUploadButton = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setRawInput(text);
      parseInput(text);
      toast.success(`Loaded schema from ${file.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to read file");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm">
          Import schema
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-[520px]">
        <DrawerHeader>
          <DrawerTitle>Import schema</DrawerTitle>
          <DrawerDescription>Upload a JSON schema or start from a template.</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-4">
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="upload">Upload JSON</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-4 space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Schema JSON</Label>
              <Textarea
                value={rawInput}
                onChange={(event) => handleTextareaChange(event.target.value)}
                className="font-mono text-xs min-h-[200px]"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Paste JSON or upload from file.</span>
                <Button variant="outline" size="sm" onClick={handleUploadButton}>
                  Upload file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </TabsContent>
            <TabsContent value="templates" className="mt-4">
              <ScrollArea className="h-[260px] pr-2">
                <div className="space-y-3">
                  {TEMPLATES.map((template) => (
                    <div key={template.url} className="border border-border rounded-lg p-3">
                      <p className="text-sm font-semibold">{template.name}</p>
                      <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                      <Button size="sm" onClick={() => handleTemplateLoad(template.url)} disabled={isLoadingTemplate}>
                        {isLoadingTemplate ? "Loading…" : "Load template"}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="grid gap-3 rounded-lg border border-border p-3 bg-muted/30">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
            {previewStats && parsedSchema ? (
              <div className="text-sm">
                <p>{previewStats.labelCount} labels</p>
                <p>{previewStats.propertyCount} properties</p>
                <p>{previewStats.relationCount} relation types</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No valid schema yet.</p>
            )}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Apply mode</Label>
              <div className="flex gap-2">
                <Button variant={mode === "replace" ? "default" : "outline"} size="sm" onClick={() => setMode("replace")}>
                  Replace
                </Button>
                <Button variant={mode === "merge" ? "default" : "outline"} size="sm" onClick={() => setMode("merge")}>
                  Merge
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DrawerFooter>
          <Button onClick={handleApply} disabled={!parsedSchema || Boolean(error)}>
            Apply schema
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

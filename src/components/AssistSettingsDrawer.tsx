import { useMemo } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { AssistConfig } from "@/types/assist";
import { cn } from "@/lib/utils";

interface AssistSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AssistConfig;
  onConfigChange: (config: AssistConfig) => void;
  onTestConnection: () => void;
  testing: boolean;
  testMessage: string | null;
}

const modeDescriptions: Record<AssistConfig["mode"], string> = {
  heuristic: "Use the built-in keyword heuristics (offline, instant).",
  ollama: "Forward the text + schema to an on-prem Ollama model that returns JSON suggestions.",
};

export const AssistSettingsDrawer = ({
  open,
  onOpenChange,
  config,
  onConfigChange,
  onTestConnection,
  testing,
  testMessage,
}: AssistSettingsDrawerProps) => {
  const helperText = useMemo(() => modeDescriptions[config.mode], [config.mode]);

  const updateField = <K extends keyof AssistConfig>(key: K, value: AssistConfig[K]) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[420px] flex flex-col gap-6">
        <SheetHeader>
          <SheetTitle>Assist Engine</SheetTitle>
          <SheetDescription>
            Configure how AnnotateX fetches pre-annotations. Keep it heuristic, or connect to your Ollama endpoint.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select
              value={config.mode}
              onValueChange={(value) => updateField("mode", value as AssistConfig["mode"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="heuristic">Heuristic (on-device)</SelectItem>
                <SelectItem value="ollama">Ollama endpoint</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{helperText}</p>
          </div>

          <Separator />

          {config.mode === "ollama" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ollama-host">Endpoint</Label>
                <Input
                  id="ollama-host"
                  value={config.ollamaHost}
                  onChange={(event) => updateField("ollamaHost", event.target.value)}
                  placeholder="http://localhost:11434"
                />
                <p className="text-xs text-muted-foreground">Base URL to your Ollama server.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ollama-model">Model</Label>
                <Input
                  id="ollama-model"
                  value={config.ollamaModel}
                  onChange={(event) => updateField("ollamaModel", event.target.value)}
                  placeholder="llama3.2:3b"
                />
                <p className="text-xs text-muted-foreground">
                  Any model installed in Ollama that can follow JSON instructions.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="assist-max">Max suggestions</Label>
                  <Input
                    id="assist-max"
                    type="number"
                    min={1}
                    max={50}
                    value={config.maxSuggestions}
                    onChange={(event) => updateField("maxSuggestions", Number(event.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assist-temp">Temperature</Label>
                  <Input
                    id="assist-temp"
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={config.temperature}
                    onChange={(event) => updateField("temperature", Number(event.target.value))}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Heuristic mode uses curated keyword hints for the default schema and never leaves the browser.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="assist-timeout">Request timeout (ms)</Label>
            <Input
              id="assist-timeout"
              type="number"
              min={2000}
              max={20000}
              step={500}
              value={config.timeoutMs}
              onChange={(event) => updateField("timeoutMs", Number(event.target.value))}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className={cn("w-full justify-center")}
              onClick={onTestConnection}
              disabled={testing}
            >
              {testing ? "Testing connection…" : "Test connection"}
            </Button>
            {testMessage && (
              <p className="text-xs text-muted-foreground whitespace-pre-line">{testMessage}</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

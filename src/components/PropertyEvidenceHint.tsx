import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PropertyEvidenceHintProps {
  evidence?: string;
  fallback?: string;
  propertyName: string;
  propertyValue?: string | number | boolean | null;
}

const formatValue = (value?: string | number | boolean | null) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
};

export const PropertyEvidenceHint = ({
  evidence,
  fallback,
  propertyName,
  propertyValue,
}: PropertyEvidenceHintProps) => {
  const snippet = evidence ?? fallback;
  if (!snippet) return null;

  const formattedValue = formatValue(propertyValue);
  const badgeLabel = evidence ? "Evidence" : "Context";
  const helper = evidence ? "Captured automatically during assist." : "Model context shown (no per-property quote).";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Show evidence for ${propertyName}`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground/80 hover:text-foreground transition-colors"
        >
          <Info className="h-3 w-3" />
          <span className="sr-only">Property evidence</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-1 text-xs">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{badgeLabel}</p>
        <p className="text-sm italic text-foreground leading-snug">“{snippet}”</p>
        {formattedValue && (
          <p className="text-[11px] text-muted-foreground/80">
            Suggested value: <span className="font-semibold text-foreground">{formattedValue}</span>
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/70">{helper}</p>
      </PopoverContent>
    </Popover>
  );
};

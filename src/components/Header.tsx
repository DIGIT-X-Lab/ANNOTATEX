import { Moon, Sun, FileJson, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export const Header = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">A</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">AnnotateX</h1>
            <p className="text-xs text-muted-foreground">by Digit-X Labs</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground italic">Transform text into structure</span>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="smooth-transition hover:bg-muted"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>
    </header>
  );
};

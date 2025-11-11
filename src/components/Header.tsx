import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/use-theme";

export const Header = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 border-b border-border bg-card/95 backdrop-blur flex items-center justify-end px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="smooth-transition hover:bg-muted"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
    </header>
  );
};

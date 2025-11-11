import { useEffect, useRef, useState } from "react";
import { Tag } from "lucide-react";
import type { Label } from "@/types/annotation";

interface FloatingLabelMenuProps {
  labels: Label[];
  position: { x: number; y: number } | null;
  onSelectLabel: (labelId: string) => void;
  onClose: () => void;
}

export const FloatingLabelMenu = ({ labels, position, onSelectLabel, onClose }: FloatingLabelMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!position) {
      setAdjustedPosition(null);
    }
  }, [position]);

  useEffect(() => {
    if (!position || !menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;

    if (x + rect.width > viewportWidth - 20) {
      x = viewportWidth - rect.width - 20;
    }
    if (x < 20) {
      x = 20;
    }

    if (y + rect.height > viewportHeight - 20) {
      y = position.y - rect.height - 10;
      if (y < 20) {
        y = viewportHeight - rect.height - 20;
      }
    }
    if (y < 20) {
      y = 20;
    }

    setAdjustedPosition({ x, y });
  }, [position, labels.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const coords = adjustedPosition ?? position;
  if (!coords) return null;

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!menuRef.current) return;
    const bounds = menuRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!dragOffset.current) return;
    const { x, y } = dragOffset.current;
    setAdjustedPosition({
      x: event.clientX - x,
      y: event.clientY - y,
    });
  };

  const handleMouseUp = () => {
    dragOffset.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 glass-panel glass-gradient rounded-xl p-3 animate-in fade-in zoom-in duration-200 max-w-[360px] cursor-grab active:cursor-grabbing"
      style={{ left: `${coords.x}px`, top: `${coords.y}px` }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/20 sticky top-0 bg-transparent backdrop-blur-sm">
        <Tag className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Choose Label</span>
      </div>

      <div className="flex flex-wrap gap-2 max-w-[320px] max-h-60 overflow-y-auto pr-1">
        {labels.map((label) => (
          <button
            key={label.id}
            onClick={() => {
              onSelectLabel(label.id);
              onClose();
            }}
            className="label-button-glass rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2 border border-white/10"
            style={{ boxShadow: `0 0 10px ${label.color}20` }}
          >
            <div className="w-3 h-3 rounded-full ring-1 ring-white/30" style={{ backgroundColor: label.color }} />
            <span>{label.name}</span>
          </button>
        ))}
      </div>

      <div className="mt-2 pt-2 border-t border-white/20 text-xs text-muted-foreground opacity-70">
        Press ESC to cancel
      </div>
    </div>
  );
};

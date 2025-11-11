import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandBannerProps {
  imageUrl?: string;
  tagline?: string;
}

export const BrandBanner = ({
  imageUrl = "/brand-banner.jpg",
  tagline = "Transform text into structured intelligence",
}: BrandBannerProps) => {
  const [hasCustomImage, setHasCustomImage] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const img = new Image();
    img.onload = () => {
      if (isMounted) setHasCustomImage(true);
    };
    img.onerror = () => {
      if (isMounted) setHasCustomImage(false);
    };
    img.src = imageUrl;
    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          hasCustomImage
            ? "bg-black/40"
            : "bg-gradient-to-r from-neutral-900 via-primary to-primary/80",
        )}
      />
      {hasCustomImage && (
        <img
          src={imageUrl}
          alt="Brand banner"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      )}
      <div className="relative px-6 py-4 flex items-center gap-4">
        <div className="hidden md:block w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="text-sm md:text-base text-white drop-shadow">
          <p className="uppercase tracking-[0.4em] text-white/70 text-xs mb-1">DIGIT-X · LMU Radiology</p>
          <h2 className="text-2xl md:text-3xl font-semibold">AnnotateX</h2>
          <p className="text-sm md:text-lg text-white/90 mt-1">{tagline}</p>
        </div>
      </div>
    </section>
  );
};

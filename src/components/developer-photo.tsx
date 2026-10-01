import { useEffect, useRef, useState } from "react";
import { ProjectCover } from "@/components/project-cover";
import { cn } from "@/lib/utils";

const initials = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
};

/**
 * Developer photo with an initials fallback when there is no image or it fails to load
 * (e.g. a remote GitHub avatar while offline).
 */
export function DeveloperPhoto({
  name,
  image,
  alt,
  className,
  fallbackSize = "xl",
  lazy = false,
}: {
  name: string;
  image: string;
  alt: string;
  className?: string;
  fallbackSize?: "lg" | "xl";
  lazy?: boolean;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    // A server-rendered image can fail before hydration, when onError isn't attached yet.
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, [image]);

  if (!image || failed)
    return (
      <ProjectCover
        name={name}
        label={initials(name)}
        image=""
        size={fallbackSize}
        className={className}
      />
    );

  return (
    <img
      ref={ref}
      src={image}
      alt={alt}
      width={768}
      height={768}
      loading={lazy ? "lazy" : undefined}
      onError={() => setFailed(true)}
      className={cn("object-cover object-top", className)}
    />
  );
}

import { cn } from "@/lib/utils";

const gradients = ["project-blue", "project-green", "project-violet", "project-ink"];

/** Uploaded cover when present; otherwise the same initials-on-gradient tile the mock profiles use. */
export function ProjectCover({
  name,
  image,
  className,
  size = "lg",
}: {
  name: string;
  image: string;
  className?: string;
  size?: "sm" | "lg";
}) {
  if (image)
    return <img src={image} alt="" className={cn("w-full bg-muted object-cover", className)} />;
  const hash = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return (
    <div
      aria-hidden="true"
      className={cn("grid place-items-center", gradients[hash % gradients.length], className)}
    >
      <span
        className={cn(
          "font-display font-extrabold text-white",
          size === "lg" ? "text-4xl" : "text-base",
        )}
      >
        {name.slice(0, 2).toUpperCase() || "··"}
      </span>
    </div>
  );
}

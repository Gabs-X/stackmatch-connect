import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Sonner injects unlayered CSS, which beats Tailwind's layered utilities. Theme it through its
// own variables (set inline on the toaster) and mark the button overrides as important.
const themeVariables = {
  "--normal-bg": "var(--card)",
  "--normal-text": "var(--foreground)",
  "--normal-border": "var(--border)",
} as CSSProperties;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={themeVariables}
      toastOptions={{
        classNames: {
          description: "text-muted-foreground!",
          actionButton: "bg-primary! text-primary-foreground!",
          cancelButton: "bg-muted! text-muted-foreground!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

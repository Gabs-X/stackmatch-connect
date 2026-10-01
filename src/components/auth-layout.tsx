import { Check, Eye, EyeOff, Info } from "lucide-react";
import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Two-column frame shared by the sign-in, sign-up and password reset screens. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <main className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <section className="stagger-item flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-extrabold">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>}
          <p className="mt-8 flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {t.auth.demoNote}
          </p>
        </div>
      </section>
      <aside className="stagger-item stagger-2 auth-panel hidden items-center px-12 py-16 lg:flex">
        <div className="max-w-md">
          <p className="font-display text-3xl font-extrabold leading-tight text-balance">
            {t.auth.brandTitle}
          </p>
          <ul className="mt-8 space-y-4">
            {t.auth.brandPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/15">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                <span className="opacity-90">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}

export function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs text-destructive">
      {message}
    </p>
  );
}

/** Password input with a show/hide toggle that keeps the field's own label and focus. */
export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    const { t } = useI18n();
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

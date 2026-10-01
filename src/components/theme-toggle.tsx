import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { useTheme, type ThemePreference } from "@/lib/theme";

export function ThemeToggle() {
  const { t } = useI18n();
  const { preference, resolved, setPreference } = useTheme();
  const options = [
    { value: "system", label: t.nav.themeSystem, icon: Monitor },
    { value: "light", label: t.nav.themeLight, icon: Sun },
    { value: "dark", label: t.nav.themeDark, icon: Moon },
  ] as const;
  const current = options.find((option) => option.value === preference) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          aria-label={`${t.nav.theme}: ${current.label}`}
          title={`${t.nav.theme}: ${current.label}`}
        >
          {resolved === "dark" ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t.nav.theme}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
        >
          {options.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="gap-2">
              <Icon className="size-4 text-muted-foreground" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

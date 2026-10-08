import { useI18n } from "@/lib/i18n";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  availabilityOptions,
  hiringOptions,
  seniorityOptions,
  workModeOptions,
} from "@/lib/developers";
import { defaultFilters, type FilterGroup, type Filters } from "@/lib/filters";

const groups = [
  [
    "tech",
    [
      "React",
      "Next.js",
      "Angular",
      "Vue",
      "Node.js",
      "NestJS",
      "C#",
      ".NET",
      "Java",
      "Python",
      "PostgreSQL",
      "AWS",
      "Docker",
    ],
    "skills",
  ],
  ["seniority", seniorityOptions, "seniority"],
  ["location", workModeOptions, "mode"],
  ["hiring", hiringOptions, "hiring"],
  ["availability", availabilityOptions, "availability"],
] as const;

export function FilterPanel({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const { t, tv } = useI18n();

  const toggle = (key: FilterGroup, item: string) =>
    onChange({
      ...value,
      [key]: value[key].includes(item)
        ? value[key].filter((x) => x !== item)
        : [...value[key], item],
    });
  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{t.filters.title}</h2>
          <p className="text-xs text-muted-foreground">{t.filters.subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onChange(defaultFilters)}>
          <RotateCcw />
          {t.filters.clear}
        </Button>
      </div>
      {groups.map(([title, items, key]) => (
        <section key={title}>
          <h3 className="mb-3 text-sm font-semibold">{t.filters[title]}</h3>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={value[key].includes(item)}
                onClick={() => toggle(key, item)}
                className={
                  value[key].includes(item) ? "filter-chip filter-chip-active" : "filter-chip"
                }
              >
                {tv(item)}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

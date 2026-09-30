import { useI18n } from "@/lib/i18n";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export type Filters = {
  skills: string[];
  seniority: string[];
  mode: string[];
  hiring: string[];
  availability: string[];
  rate: number[];
};
export type FilterGroup = Exclude<keyof Filters, "rate">;
export const defaultFilters: Filters = {
  skills: [],
  seniority: [],
  mode: [],
  hiring: [],
  availability: [],
  rate: [300],
};
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
  ["seniority", ["Júnior", "Pleno", "Sênior"], "seniority"],
  ["location", ["Remoto", "Híbrido", "Presencial"], "mode"],
  ["hiring", ["Freelancer", "Contrato", "CLT", "PJ"], "hiring"],
  ["availability", ["Disponível agora", "Em 15 dias", "Em 30 dias"], "availability"],
] as const;

export function FilterPanel({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const { t, tv, formatCurrency } = useI18n();

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
      <section>
        <div className="mb-4 flex justify-between text-sm font-semibold">
          <span>{t.filters.maxRate}</span>
          <span>{formatCurrency(value.rate[0] ?? 300)}</span>
        </div>
        <Slider
          min={60}
          max={300}
          step={10}
          value={value.rate}
          onValueChange={(rate) => onChange({ ...value, rate })}
        />
      </section>
    </div>
  );
}

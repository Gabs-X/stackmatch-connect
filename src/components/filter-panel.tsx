import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export type Filters = { skills: string[]; seniority: string[]; mode: string[]; rate: number[] };
export const defaultFilters: Filters = { skills: [], seniority: [], mode: [], rate: [250] };
const groups = [
  ["Tecnologias", ["React", "Next.js", "Angular", "Vue", "Node.js", "NestJS", "C#", ".NET", "Java", "Python", "PostgreSQL", "AWS", "Docker"], "skills"],
  ["Senioridade", ["Júnior", "Pleno", "Sênior"], "seniority"],
  ["Localização", ["Remoto", "Híbrido", "Presencial"], "mode"],
] as const;

export function FilterPanel({ value, onChange }: { value: Filters; onChange: (next: Filters) => void }) {
  const toggle = (key: "skills" | "seniority" | "mode", item: string) => onChange({ ...value, [key]: value[key].includes(item) ? value[key].filter((x) => x !== item) : [...value[key], item] });
  return <div className="space-y-7">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Filtros</h2><p className="text-xs text-muted-foreground">Refine sua busca</p></div><Button variant="ghost" size="sm" onClick={() => onChange(defaultFilters)}><RotateCcw />Limpar</Button></div>
    {groups.map(([title, items, key]) => <section key={title}><h3 className="mb-3 text-sm font-semibold">{title}</h3><div className="flex flex-wrap gap-2">{items.map((item) => <button key={item} onClick={() => toggle(key, item)} className={value[key].includes(item) ? "filter-chip filter-chip-active" : "filter-chip"}>{item}</button>)}</div></section>)}
    <section><div className="mb-4 flex justify-between text-sm font-semibold"><span>Valor máximo/h</span><span>R$ {value.rate[0]}</span></div><Slider min={60} max={300} step={10} value={value.rate} onValueChange={(rate) => onChange({ ...value, rate })} /></section>
    <section><h3 className="mb-3 text-sm font-semibold">Contratação</h3><div className="flex flex-wrap gap-2">{["Freelancer", "Contrato", "CLT", "PJ"].map((x) => <span className="filter-chip" key={x}>{x}</span>)}</div></section>
  </div>;
}
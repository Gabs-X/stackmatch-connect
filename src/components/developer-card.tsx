import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Briefcase, Clock3, MapPin } from "lucide-react";
import type { Developer } from "@/lib/developers";
import { Button } from "@/components/ui/button";

export function DeveloperCard({ developer, compact = false }: { developer: Developer; compact?: boolean }) {
  return <article className={compact ? "talent-card" : "developer-card"}>
    <div className={compact ? "relative h-52 overflow-hidden" : "relative h-64 overflow-hidden sm:h-72"}>
      <img src={developer.image} alt={`Foto de ${developer.name}`} width={768} height={768} loading="lazy" className="h-full w-full object-cover" />
      <span className="availability-badge"><span className="status-dot" />{developer.availability}</span>
    </div>
    <div className={compact ? "p-5" : "p-6"}>
      <div className="flex items-start justify-between gap-3">
        <div><h2 className={compact ? "text-lg font-bold" : "text-2xl font-bold"}>{developer.name}</h2><p className="mt-0.5 text-sm font-medium text-primary">{developer.role}</p></div>
        {!compact && <span className="level-badge">{developer.seniority}</span>}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{developer.location}</span>
        <span className="inline-flex items-center gap-1.5"><Briefcase className="size-3.5" />{developer.workMode}</span>
        {!compact && <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{developer.experience}</span>}
      </div>
      {!compact && <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{developer.bio}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{developer.skills.slice(0, compact ? 3 : 5).map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}</div>
      {compact && <Button asChild variant="outline" className="mt-5 w-full"><Link to="/developer/$id" params={{ id: developer.id }}>Ver perfil <ArrowUpRight /></Link></Button>}
    </div>
  </article>;
}
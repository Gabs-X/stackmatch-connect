import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookmarkCheck, Check, Filter, Layers3, Search, Sparkles, Timer, UserRoundSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeveloperCard } from "@/components/developer-card";
import { developers } from "@/lib/developers";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "StackMatch — Encontre o desenvolvedor certo" },
    { name: "description", content: "Descubra profissionais de tecnologia por stack, experiência e disponibilidade." },
    { property: "og:title", content: "StackMatch — Encontre o desenvolvedor certo" },
    { property: "og:description", content: "Talentos tech compatíveis com seu projeto, em poucos minutos." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  const benefits = [[Timer,"Busca mais rápida"],[Filter,"Filtros inteligentes"],[Layers3,"Análise por projetos"],[Sparkles,"Disponibilidade visível"]] as const;
  const featuredDeveloper = developers.find((developer) => developer.id === "marina-costa");
  return <main>
    <section className="hero-band"><div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_.8fr] lg:px-8 lg:py-20">
      <div className="animate-fade-in"><span className="eyebrow"><span className="status-dot" /> Mais de 2.400 talentos verificados</span><h1 className="mt-6 max-w-3xl font-display text-5xl font-extrabold leading-[1.05] sm:text-6xl">Encontre o desenvolvedor certo para o seu <span className="text-primary">próximo projeto.</span></h1><p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">Descubra profissionais com as tecnologias, experiência e disponibilidade que sua empresa precisa.</p><div className="mt-8 flex flex-wrap gap-3"><Button size="lg" asChild><Link to="/discover">Encontrar talentos <ArrowRight /></Link></Button><Button size="lg" variant="outline" asChild><Link to="/create-profile">Criar meu perfil</Link></Button></div><div className="mt-8 flex flex-wrap gap-5 text-sm text-muted-foreground">{["Sem cadastro", "Perfis verificados", "Resposta rápida"].map(x=><span className="flex items-center gap-1.5" key={x}><Check className="size-4 text-positive" />{x}</span>)}</div></div>
      {featuredDeveloper && <div className="relative mx-auto w-full max-w-md animate-scale-in"><div className="absolute -left-7 top-16 hidden rounded-lg border bg-card p-3 shadow-soft sm:block"><p className="text-xs text-muted-foreground">Match com sua vaga</p><p className="font-display text-2xl font-bold text-primary">94%</p></div><DeveloperCard developer={featuredDeveloper} /><div className="absolute -bottom-5 -right-5 rounded-lg border bg-card p-3 shadow-soft"><p className="flex items-center gap-2 text-sm font-semibold"><span className="status-dot" />Disponível agora</p></div></div>}
    </div></section>
    <section className="border-y bg-card"><div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="max-w-xl"><span className="section-kicker">Como funciona</span><h2 className="section-title">Do briefing ao match em três passos.</h2></div><div className="mt-12 grid gap-8 md:grid-cols-3">{[{Icon:UserRoundSearch,n:"01",title:"Defina o que procura",description:"Escolha stack, senioridade, modelo de trabalho e faixa de valor."},{Icon:Search,n:"02",title:"Descubra profissionais",description:"Explore perfis completos e projetos relevantes para sua vaga."},{Icon:BookmarkCheck,n:"03",title:"Salve seus favoritos",description:"Monte uma shortlist e avance com os melhores talentos."}].map(({Icon,n,title,description})=><div className="step-item" key={title}><div className="flex items-center justify-between"><span className="feature-icon"><Icon /></span><span className="font-mono text-sm text-muted-foreground">{n}</span></div><h3 className="mt-6 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></div>)}</div></div></section>
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]"><div><span className="section-kicker">Feito para decidir melhor</span><h2 className="section-title">Menos currículos.<br/>Mais contexto.</h2><p className="mt-5 text-muted-foreground">Veja o que realmente importa antes da primeira conversa.</p></div><div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">{benefits.map(([Icon,title])=><div className="bg-background p-7" key={title}><Icon className="size-5 text-primary"/><h3 className="mt-5 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Informações objetivas para comparar talentos com confiança.</p></div>)}</div></div></section>
    <section className="cta-band"><div className="mx-auto max-w-4xl px-4 py-20 text-center"><h2 className="font-display text-4xl font-extrabold">Seu próximo talento está a um match de distância.</h2><p className="mx-auto mt-4 max-w-xl text-primary-foreground/70">Comece agora e descubra profissionais prontos para transformar seu projeto.</p><Button variant="secondary" size="lg" className="mt-8" asChild><Link to="/discover">Explorar talentos <ArrowRight /></Link></Button></div></section>
  </main>;
}

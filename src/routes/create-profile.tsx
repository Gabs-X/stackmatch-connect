import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Eye, Github, Plus, Upload, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyProfile,
  loadLocalProfile,
  saveLocalProfile,
  profileLink,
  type LocalProfile,
} from "@/lib/local-profile";

export const Route = createFileRoute("/create-profile")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      {
        name: "description",
        content: "Monte seu mini portfólio profissional e destaque seus melhores projetos.",
      },
      { property: "og:title", content: "Crie seu perfil — Stack Match" },
      {
        property: "og:description",
        content: "Mostre sua experiência e seus projetos para empresas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateProfile,
});
const repos = ["Ecommerce API", "Portfolio", "Task Manager", "Finance Dashboard"];
function CreateProfile() {
  const { t } = useI18n();
  useLocalizedMeta(t.create.title + " — Stack Match", t.create.sub);
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState(false);
  const [profile, setProfile] = useState<LocalProfile>(emptyProfile);
  const [completed, setCompleted] = useState(false);
  const { skills, projects } = profile;
  const [skill, setSkill] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const bioId = useId();
  const skillId = useId();
  useEffect(() => {
    const stored = loadLocalProfile();
    if (stored) {
      setProfile(stored);
      setCompleted(true);
      setPreview(true);
    }
  }, []);
  const updateField = <Key extends keyof LocalProfile>(field: Key, value: LocalProfile[Key]) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setCompleted(false);
  };
  const finishProfile = () => {
    if (!profile.name.trim() || !profile.role.trim()) {
      setStep(1);
      toast.error(t.create.requiredFields);
      return;
    }
    try {
      const saved = saveLocalProfile(profile);
      setProfile(saved);
      setCompleted(true);
      setPreview(true);
      toast.success(t.create.finishToast, { description: t.create.finishDesc });
    } catch {
      toast.error(t.create.saveError);
    }
  };
  const steps = [t.create.steps[0], t.create.steps[1], t.create.projects, t.create.steps[3]];
  const addSkill = () => {
    if (skill.trim() && !skills.includes(skill.trim())) {
      updateField("skills", [...skills, skill.trim()]);
      setSkill("");
    }
  };
  if (preview)
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Button variant="outline" onClick={() => setPreview(false)}>
          <ChevronLeft />
          {t.create.backEdit}
        </Button>
        {completed && (
          <p role="status" className="mt-4 text-sm text-positive">
            {t.create.finishToast} {t.create.finishDesc}
          </p>
        )}
        <div className="mt-7 overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="h-40 bg-foreground" />
          <div className="px-6 pb-10 sm:px-10">
            <div className="-mt-16 size-32 rounded-xl border-4 border-card bg-muted" />
            <h1 className="mt-5 font-display text-3xl font-extrabold">
              {profile.name || t.create.yourName}
            </h1>
            <p className="mt-1 font-semibold text-primary">{profile.role || t.create.yourRole}</p>
            {[profile.location, profile.seniority, profile.availability].some(Boolean) && (
              <p className="mt-3 text-sm text-muted-foreground">
                {[profile.location, profile.seniority, profile.availability]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <p className="mt-5 max-w-2xl whitespace-pre-wrap text-muted-foreground">
              {profile.bio || t.create.yourBio}
            </p>
            <h2 className="mt-10 text-xl font-bold">{t.create.steps[1]}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {skills.map((s) => (
                <span className="skill-chip" key={s}>
                  {s}
                </span>
              ))}
            </div>
            {[profile.github, profile.linkedin, profile.website].some(Boolean) && (
              <section className="mt-10">
                <h2 className="text-xl font-bold">{t.create.steps[3]}</h2>
                <div className="mt-4 space-y-2 text-sm">
                  {[
                    ["GitHub", profile.github],
                    ["LinkedIn", profile.linkedin],
                    [t.create.site, profile.website],
                  ].map(
                    ([label, value]) =>
                      value && (
                        <p key={label} className="break-words">
                          <span className="font-semibold">{label}: </span>
                          {profileLink(value) ? (
                            <a
                              className="text-primary underline"
                              href={profileLink(value)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {value}
                            </a>
                          ) : (
                            value
                          )}
                        </p>
                      ),
                  )}
                </div>
              </section>
            )}
            <h2 className="mt-10 text-xl font-bold">{t.create.projects}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {projects.length ? (
                projects.map((p) => (
                  <div className="rounded-lg border p-5" key={p}>
                    <h3 className="font-bold">{p}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{t.create.imported}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t.create.addProjectsHint}</p>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="section-kicker">{t.create.kicker}</span>
          <h1 className="mt-1 font-display text-3xl font-extrabold">{t.create.title}</h1>
          <p className="mt-2 text-muted-foreground">{t.create.sub}</p>
        </div>
        <Button variant="outline" onClick={() => setPreview(true)}>
          <Eye />
          {t.create.preview}
        </Button>
      </div>
      <div className="mt-9 grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside>
          <div className="space-y-1">
            {steps.map((name, i) => (
              <button
                key={name}
                onClick={() => setStep(i + 1)}
                className={`flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold ${step === i + 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <span
                  className={`grid size-7 place-items-center rounded-full border text-xs ${step > i + 1 ? "bg-positive text-primary-foreground" : ""}`}
                >
                  {step > i + 1 ? <Check className="size-3.5" /> : i + 1}
                </span>
                {name}
              </button>
            ))}
          </div>
        </aside>
        <section className="rounded-xl border bg-card p-6 shadow-soft sm:p-8">
          <div className="mb-8">
            <p className="text-xs font-bold text-primary">{t.create.stepOf(step)}</p>
            <h2 className="mt-1 text-2xl font-bold">{steps[step - 1]}</h2>
          </div>
          {step === 1 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={t.create.fullName}
                placeholder={t.create.fullNamePh}
                value={profile.name}
                onChange={(value) => updateField("name", value)}
              />
              <Field
                label={t.create.role}
                placeholder={t.create.rolePh}
                value={profile.role}
                onChange={(value) => updateField("role", value)}
              />
              <Field
                label={t.create.location}
                placeholder={t.create.locationPh}
                value={profile.location}
                onChange={(value) => updateField("location", value)}
              />
              <Field
                label={t.create.seniority}
                placeholder={t.create.seniorityPh}
                value={profile.seniority}
                onChange={(value) => updateField("seniority", value)}
              />
              <Field
                label={t.create.availability}
                placeholder={t.create.availabilityPh}
                value={profile.availability}
                onChange={(value) => updateField("availability", value)}
              />
              <div className="sm:col-span-2">
                <Label htmlFor={bioId}>{t.create.bio}</Label>
                <Textarea
                  id={bioId}
                  className="mt-2 min-h-28"
                  placeholder={t.create.bioPh}
                  value={profile.bio}
                  onChange={(event) => updateField("bio", event.target.value)}
                />
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <Label htmlFor={skillId}>{t.create.tech}</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id={skillId}
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder={t.create.skillPh}
                />
                <Button
                  onClick={addSkill}
                  disabled={!skill.trim() || skills.includes(skill.trim())}
                >
                  <Plus />
                  {t.create.add}
                </Button>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {skills.map((s) => (
                  <button
                    className="skill-chip flex items-center gap-1"
                    key={s}
                    onClick={() =>
                      updateField(
                        "skills",
                        skills.filter((x) => x !== s),
                      )
                    }
                  >
                    {s}
                    <X className="size-3" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <div className="rounded-lg border border-dashed p-7 text-center">
                <Upload className="mx-auto text-muted-foreground" />
                <h3 className="mt-3 font-bold">{t.create.addWork}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t.create.addWorkSub}</p>
                <Dialog
                  open={manualOpen}
                  onOpenChange={(open) => {
                    setManualOpen(open);
                    if (!open) setProjectName("");
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" className="mt-4">
                      <Plus />
                      {t.create.addManual}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t.create.addManual}</DialogTitle>
                      <DialogDescription>{t.create.manualDesc}</DialogDescription>
                    </DialogHeader>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const name = projectName.trim();
                        if (!name || projects.some((p) => p.toLowerCase() === name.toLowerCase()))
                          return;
                        updateField("projects", [...projects, name]);
                        setManualOpen(false);
                        setProjectName("");
                      }}
                    >
                      <Field
                        label={t.create.projectName}
                        placeholder={t.create.projectName}
                        value={projectName}
                        onChange={setProjectName}
                      />
                      <DialogFooter className="mt-4">
                        <Button
                          type="submit"
                          disabled={
                            !projectName.trim() ||
                            projects.some(
                              (p) => p.toLowerCase() === projectName.trim().toLowerCase(),
                            )
                          }
                        >
                          {t.create.add}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Dialog
                open={importOpen}
                onOpenChange={(open) => {
                  setImportOpen(open);
                  if (!open) setSelected([]);
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="secondary" className="mt-4 w-full">
                    <Github />
                    {t.create.importGh}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t.create.importTitle}</DialogTitle>
                    <DialogDescription>{t.create.importDesc}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    {repos.map((r) => (
                      <button
                        key={r}
                        disabled={projects.includes(r)}
                        aria-pressed={selected.includes(r) || projects.includes(r)}
                        onClick={() =>
                          setSelected(
                            selected.includes(r)
                              ? selected.filter((x) => x !== r)
                              : [...selected, r],
                          )
                        }
                        className={`flex w-full items-center justify-between rounded-lg border p-4 text-left font-semibold disabled:opacity-50 ${selected.includes(r) ? "border-primary bg-secondary" : ""}`}
                      >
                        {r}
                        {(selected.includes(r) || projects.includes(r)) && (
                          <Check className="size-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button
                      disabled={!selected.length}
                      onClick={() => {
                        updateField("projects", [...new Set([...projects, ...selected])]);
                        setSelected([]);
                        setImportOpen(false);
                        toast.success(t.create.importToast);
                      }}
                    >
                      {t.create.importSelected}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {projects.length > 0 && (
                <div className="mt-5 space-y-2">
                  {projects.map((p) => (
                    <div
                      className="flex items-center justify-between rounded-lg border p-4"
                      key={p}
                    >
                      <span className="font-semibold">{p}</span>
                      <Check className="size-4 text-positive" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {step === 4 && (
            <div className="space-y-5">
              <Field
                label="GitHub"
                placeholder={t.create.ghPh}
                value={profile.github}
                onChange={(value) => updateField("github", value)}
              />
              <Field
                label="LinkedIn"
                placeholder={t.create.liPh}
                value={profile.linkedin}
                onChange={(value) => updateField("linkedin", value)}
              />
              <Field
                label={t.create.site}
                placeholder={t.create.sitePh}
                value={profile.website}
                onChange={(value) => updateField("website", value)}
              />
            </div>
          )}
          <div className="mt-10 flex justify-between border-t pt-6">
            <Button variant="ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>
              <ChevronLeft />
              {t.create.back}
            </Button>
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)}>
                {t.create.next}
                <ChevronRight />
              </Button>
            ) : (
              <Button onClick={finishProfile}>
                {t.create.finish}
                <Check />
              </Button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-2"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

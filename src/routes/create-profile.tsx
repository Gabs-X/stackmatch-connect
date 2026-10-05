import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Github,
  IdCard,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { ProfilePreview } from "@/components/profile-preview";
import { ProjectCover } from "@/components/project-cover";
import { ProjectFormDialog } from "@/components/project-form-dialog";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  missingProfileFields,
  newProject,
  requiredProfileFields,
  profileLink,
  type LocalProfile,
  type LocalProject,
  type RequiredProfileField,
} from "@/lib/local-profile";
import { myProfileQuery, publishedProfilesQuery, saveMyProfile } from "@/lib/profile-api";
import { FieldError } from "@/components/auth-layout";
import {
  availabilityOptions,
  hiringOptions,
  seniorityOptions,
  workModeOptions,
} from "@/lib/developers";

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
  component: () => (
    <RequireAccount type="developer">
      <CreateProfile />
    </RequireAccount>
  ),
});
function CreateProfile() {
  const { t, tv } = useI18n();
  useLocalizedMeta(t.create.title + " — Stack Match", t.create.sub);
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState(false);
  // In the preview, swaps the full profile for the card companies see in Discover.
  const [showCard, setShowCard] = useState(false);
  const [profile, setProfile] = useState<LocalProfile>(emptyProfile);
  const [completed, setCompleted] = useState(false);
  const { skills, projects } = profile;
  const [skill, setSkill] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LocalProject | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const bioId = useId();
  const skillId = useId();
  const { user } = useAuth();
  // RequireAccount only renders this page for a signed-in developer.
  const accountId = user?.id ?? "";
  const queryClient = useQueryClient();
  // Only this account edits its profile, so what was loaded stays current while editing.
  const stored = useQuery({
    ...myProfileQuery(accountId),
    enabled: !!accountId,
    staleTime: Infinity,
  });
  useEffect(() => {
    // Each account edits its own profile; the demo developer starts from its ready-made one.
    if (stored.data) {
      setProfile(stored.data);
      setCompleted(true);
      setPreview(true);
    }
  }, [stored.data]);
  // A developer account starts its first profile with the name and title from sign-up.
  useEffect(() => {
    if (user?.accountType !== "developer" || !stored.isSuccess || stored.data) return;
    setProfile((current) =>
      current.name || current.role ? current : { ...current, name: user.name, role: user.jobTitle },
    );
  }, [user, stored.isSuccess, stored.data]);
  const [saving, setSaving] = useState(false);
  const updateField = <Key extends keyof LocalProfile>(field: Key, value: LocalProfile[Key]) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setCompleted(false);
  };
  // Blank required fields show as errors only once the developer tried to leave their step.
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (focusRequest) document.querySelector<HTMLElement>('main [aria-invalid="true"]')?.focus();
  }, [focusRequest]);
  const missing = missingProfileFields(profile);
  const errorFor = (field: RequiredProfileField) => {
    if (!checkedSteps.includes(requiredProfileFields[field]) || !missing.includes(field))
      return undefined;
    if (field === "skills") return t.create.requiredErrors.skills;
    return field === "seniority" || field === "workMode" || field === "availability"
      ? t.create.requiredErrors.select
      : t.create.requiredErrors.text;
  };
  /** Stops at the first step before `target` with blank required fields; true when none. */
  const requiredFilledBefore = (target: number) => {
    const blockedSteps = missing
      .map((field) => requiredProfileFields[field])
      .filter((fieldStep) => fieldStep < target);
    if (!blockedSteps.length) return true;
    const blocked = Math.min(...blockedSteps);
    setCheckedSteps((current) => (current.includes(blocked) ? current : [...current, blocked]));
    setStep(blocked);
    setFocusRequest((current) => current + 1);
    toast.error(t.create.requiredFields);
    return false;
  };
  const goToStep = (target: number) => {
    if (target <= step || requiredFilledBefore(target)) setStep(target);
  };
  const finishProfile = async () => {
    if (!requiredFilledBefore(steps.length + 1)) return;
    setSaving(true);
    try {
      // The server stores the profile as it will show it; the form continues from that.
      const saved = await saveMyProfile({ data: profile });
      if (!saved) throw new Error("Profile not saved");
      queryClient.setQueryData(myProfileQuery(accountId).queryKey, saved);
      void queryClient.invalidateQueries({ queryKey: publishedProfilesQuery.queryKey });
      setProfile(saved);
      setCompleted(true);
      setPreview(true);
      toast.success(t.create.finishToast, { description: t.create.finishDesc });
    } catch {
      toast.error(t.create.saveError);
    } finally {
      setSaving(false);
    }
  };
  const hasProject = (name: string) =>
    projects.some((project) => project.name.toLowerCase() === name.toLowerCase());
  const openProjectForm = (project: LocalProject | null) => {
    setEditing(project);
    setFormOpen(true);
  };
  const saveProject = (project: LocalProject) => {
    updateField(
      "projects",
      projects.some((item) => item.id === project.id)
        ? projects.map((item) => (item.id === project.id ? project : item))
        : [...projects, project],
    );
    setFormOpen(false);
    toast.success(t.create.projectSaved, { description: project.name });
  };
  const removeProject = (project: LocalProject) => {
    const position = projects.findIndex((item) => item.id === project.id);
    updateField(
      "projects",
      projects.filter((item) => item.id !== project.id),
    );
    toast(t.create.projectRemoved, {
      description: project.name,
      action: {
        label: t.discover.undo,
        onClick: () =>
          setProfile((current) => {
            if (current.projects.some((item) => item.id === project.id)) return current;
            const next = [...current.projects];
            next.splice(Math.min(position, next.length), 0, project);
            return { ...current, projects: next };
          }),
      },
    });
  };
  // With a GitHub profile filled in, mock imports point at that account; otherwise they have no repo link.
  const githubBase = profileLink(profile.github)?.replace(/\/+$/, "");
  const importSelected = () => {
    const imported = t.create.importRepos
      .filter((repo) => selected.includes(repo.name) && !hasProject(repo.name))
      .map((repo) =>
        newProject({
          name: repo.name,
          description: repo.description,
          tech: [...repo.tech],
          github: githubBase ? `${githubBase}/${repo.name.toLowerCase().replace(/\s+/g, "-")}` : "",
        }),
      );
    updateField("projects", [...projects, ...imported]);
    setSelected([]);
    setImportOpen(false);
    toast.success(t.create.importToast);
  };
  const steps = [t.create.steps[0], t.create.steps[1], t.create.projects, t.create.steps[3]];
  const addSkill = () => {
    if (skill.trim() && !skills.includes(skill.trim())) {
      updateField("skills", [...skills, skill.trim()]);
      setSkill("");
    }
  };
  if (stored.isPending && accountId)
    return (
      <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4">
        <p role="status" className="text-sm text-muted-foreground">
          {t.common.loading}
        </p>
      </main>
    );
  if (preview)
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPreview(false)}>
            <ChevronLeft />
            {t.create.backEdit}
          </Button>
          <Button variant="outline" onClick={() => setShowCard((current) => !current)}>
            {showCard ? <UserRound /> : <IdCard />}
            {showCard ? t.create.showFullProfile : t.create.showCard}
          </Button>
          {completed && (
            <Button asChild>
              <Link to="/interests">
                {t.create.viewInterested}
                <ChevronRight />
              </Link>
            </Button>
          )}
        </div>
        {completed && (
          <p role="status" className="mt-4 text-sm text-positive">
            {t.create.finishToast} {t.create.finishDesc}
          </p>
        )}
        <ProfilePreview profile={profile} accountId={accountId} showCard={showCard} />
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
      <div className="mt-9 grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-10">
        <aside className="stagger-item">
          {/* A compact row of steps on phones; a vertical list beside the form on large screens. */}
          <div className="grid grid-cols-4 gap-1 lg:block lg:space-y-1">
            {steps.map((name, i) => (
              <button
                key={name}
                onClick={() => goToStep(i + 1)}
                aria-current={step === i + 1 ? "step" : undefined}
                className={`flex w-full flex-col items-center gap-1 rounded-lg p-2 text-center text-[11px] font-semibold leading-tight lg:flex-row lg:gap-3 lg:p-3 lg:text-left lg:text-sm ${step === i + 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
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
        <section className="stagger-item stagger-1 rounded-xl border bg-card p-6 shadow-soft sm:p-8">
          <div className="mb-8">
            <p className="text-xs font-bold text-primary">{t.create.stepOf(step)}</p>
            <h2 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold">
              {steps[step - 1]}
              {step >= 3 && <span className="level-badge">{t.create.optional}</span>}
            </h2>
            {step < 4 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {step === 3 ? t.create.projectsOptional : t.create.requiredNote}
              </p>
            )}
          </div>
          {step === 1 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={t.create.fullName}
                placeholder={t.create.fullNamePh}
                value={profile.name}
                onChange={(value) => updateField("name", value)}
                required
                error={errorFor("name")}
              />
              <Field
                label={t.create.role}
                placeholder={t.create.rolePh}
                value={profile.role}
                onChange={(value) => updateField("role", value)}
                required
                error={errorFor("role")}
              />
              <Field
                label={t.create.location}
                placeholder={t.create.locationPh}
                value={profile.location}
                onChange={(value) => updateField("location", value)}
                required
                error={errorFor("location")}
              />
              <SelectField
                label={t.create.seniority}
                value={profile.seniority}
                required
                error={errorFor("seniority")}
                options={seniorityOptions}
                onChange={(value) => updateField("seniority", value)}
              />
              <SelectField
                label={t.create.workMode}
                value={profile.workMode}
                required
                error={errorFor("workMode")}
                options={workModeOptions}
                onChange={(value) => updateField("workMode", value)}
              />
              <SelectField
                label={t.create.availability}
                value={profile.availability}
                required
                error={errorFor("availability")}
                options={availabilityOptions}
                onChange={(value) => updateField("availability", value)}
              />
              <Field
                label={t.create.experienceYears}
                placeholder={t.create.experienceYearsPh}
                inputMode="numeric"
                value={profile.experienceYears?.toString() ?? ""}
                onChange={(value) => updateField("experienceYears", wholeNumber(value, 60))}
              />
              <Field
                label={t.create.rate}
                placeholder={t.create.ratePh}
                inputMode="numeric"
                value={profile.rate?.toString() ?? ""}
                onChange={(value) => updateField("rate", wholeNumber(value, 10000))}
              />
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-medium">{t.create.hiringTypes}</legend>
                <p className="mt-1 text-xs text-muted-foreground">{t.create.hiringTypesHint}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {hiringOptions.map((option) => {
                    const selected = profile.hiringTypes.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        className={selected ? "filter-chip filter-chip-active" : "filter-chip"}
                        onClick={() =>
                          updateField(
                            "hiringTypes",
                            selected
                              ? profile.hiringTypes.filter((item) => item !== option)
                              : [...profile.hiringTypes, option],
                          )
                        }
                      >
                        {tv(option)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="sm:col-span-2">
                <Label htmlFor={bioId}>
                  {t.create.bio}
                  <RequiredMark />
                </Label>
                <Textarea
                  id={bioId}
                  className="mt-2 min-h-28"
                  placeholder={t.create.bioPh}
                  value={profile.bio}
                  onChange={(event) => updateField("bio", event.target.value)}
                  aria-required="true"
                  aria-invalid={errorFor("bio") ? true : undefined}
                  aria-describedby={errorFor("bio") ? `${bioId}-error` : undefined}
                />
                <FieldError id={`${bioId}-error`} message={errorFor("bio")} />
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <Label htmlFor={skillId}>
                {t.create.tech}
                <RequiredMark />
              </Label>
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
                  aria-required="true"
                  aria-invalid={errorFor("skills") ? true : undefined}
                  aria-describedby={errorFor("skills") ? `${skillId}-error` : undefined}
                />
                <Button
                  onClick={addSkill}
                  disabled={!skill.trim() || skills.includes(skill.trim())}
                >
                  <Plus />
                  {t.create.add}
                </Button>
              </div>
              <FieldError id={`${skillId}-error`} message={errorFor("skills")} />
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
              {projects.length > 0 && (
                <ul className="mb-5 space-y-3">
                  {projects.map((project) => (
                    <li
                      key={project.id}
                      className="flex gap-4 rounded-lg border p-3 sm:items-center"
                    >
                      <ProjectCover
                        name={project.name}
                        image={project.image}
                        size="sm"
                        className="aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-md sm:w-28"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{project.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          {project.description || t.create.noDescription}
                        </p>
                        {project.tech.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {project.tech.map((tech) => (
                              <span className="skill-chip" key={tech}>
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t.create.editProjectA11y(project.name)}
                          title={t.create.editProject}
                          onClick={() => openProjectForm(project)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-danger-soft hover:text-destructive"
                          aria-label={t.create.removeProjectA11y(project.name)}
                          onClick={() => removeProject(project)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="rounded-lg border border-dashed p-7 text-center">
                <Upload className="mx-auto text-muted-foreground" />
                <h3 className="mt-3 font-bold">{t.create.addWork}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t.create.addWorkSub}</p>
                <Button variant="outline" className="mt-4" onClick={() => openProjectForm(null)}>
                  <Plus />
                  {t.create.addManual}
                </Button>
              </div>
              <ProjectFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                project={editing}
                takenNames={projects
                  .filter((project) => project.id !== editing?.id)
                  .map((project) => project.name.toLowerCase())}
                skillSuggestions={skills}
                onSave={saveProject}
              />
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
                {projects.length === 0 && (
                  <Button variant="ghost" className="mt-2 w-full" onClick={() => goToStep(4)}>
                    {t.create.skipProjects}
                    <ChevronRight />
                  </Button>
                )}
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t.create.importTitle}</DialogTitle>
                    <DialogDescription>{t.create.importDesc}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    {t.create.importRepos.map((repo) => {
                      const added = hasProject(repo.name);
                      const checked = added || selected.includes(repo.name);
                      return (
                        <button
                          key={repo.name}
                          type="button"
                          disabled={added}
                          aria-pressed={checked}
                          onClick={() =>
                            setSelected(
                              selected.includes(repo.name)
                                ? selected.filter((name) => name !== repo.name)
                                : [...selected, repo.name],
                            )
                          }
                          className={`flex w-full items-start justify-between gap-3 rounded-lg border p-4 text-left disabled:opacity-50 ${selected.includes(repo.name) ? "border-primary bg-secondary" : ""}`}
                        >
                          <span>
                            <span className="block font-semibold">{repo.name}</span>
                            <span className="mt-0.5 block text-sm text-muted-foreground">
                              {repo.description}
                            </span>
                            <span className="mt-1.5 block text-xs font-medium text-muted-foreground">
                              {repo.tech.join(" · ")}
                            </span>
                          </span>
                          {checked && <Check className="mt-1 size-4 shrink-0 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                  <DialogFooter>
                    <Button disabled={!selected.length} onClick={importSelected}>
                      {t.create.importSelected}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
              <Button onClick={() => goToStep(step + 1)}>
                {t.create.next}
                <ChevronRight />
              </Button>
            ) : (
              <Button onClick={() => void finishProfile()} disabled={saving}>
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
function SelectField({
  label,
  value,
  options,
  onChange,
  required = false,
  error,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  required?: boolean;
  error?: string | undefined;
}) {
  const { t, tv } = useI18n();
  const id = useId();
  // Older profiles stored free text; keep an unmatched value selectable instead of dropping it.
  const legacy = value && !options.includes(value) ? value : "";
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </Label>
      <div className="relative mt-2">
        {/* appearance-none: Chrome paints its own dark menulist over the author background. */}
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "h-9 w-full cursor-pointer appearance-none rounded-md border border-input bg-transparent pl-3 pr-9 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm",
            !value && "text-muted-foreground",
          )}
        >
          {/* Shown while nothing is chosen, but not selectable from the list. */}
          <option value="" disabled hidden>
            {t.create.selectPh}
          </option>
          {legacy && <option value={legacy}>{legacy}</option>}
          {options.map((option) => (
            <option key={option} value={option}>
              {tv(option)}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
/** Keeps only the digits typed, capped at `max`; empty means "not answered". */
function wholeNumber(value: string, max: number) {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  return digits ? Math.min(Number(digits), max) : null;
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  inputMode,
  required = false,
  error,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "numeric";
  required?: boolean;
  error?: string | undefined;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </Label>
      <Input
        id={id}
        className="mt-2"
        placeholder={placeholder}
        {...(inputMode ? { inputMode } : {})}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** Asterisk after a required label; screen readers get aria-required from the field instead. */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-destructive">
      *
    </span>
  );
}

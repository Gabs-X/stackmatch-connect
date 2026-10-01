import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ProjectCover } from "@/components/project-cover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { newProject, profileLink, readProjectImage, type LocalProject } from "@/lib/local-profile";

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  takenNames,
  skillSuggestions,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Project being edited; null opens an empty form. */
  project: LocalProject | null;
  /** Lowercased names of the other projects, to block duplicates. */
  takenNames: string[];
  skillSuggestions: string[];
  onSave: (project: LocalProject) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<LocalProject>(() => project ?? newProject());
  const [techInput, setTechInput] = useState("");
  const [touched, setTouched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ids = {
    name: useId(),
    description: useId(),
    tech: useId(),
    image: useId(),
    github: useId(),
    demo: useId(),
  };

  // Reset the form each time it opens, so a cancelled edit never leaks into the next one.
  useEffect(() => {
    if (!open) return;
    setDraft(project ?? newProject());
    setTechInput("");
    setTouched(false);
  }, [open, project]);

  const update = <Key extends keyof LocalProject>(key: Key, value: LocalProject[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const name = draft.name.trim();
  const nameError = !name
    ? t.create.projectNameRequired
    : takenNames.includes(name.toLowerCase())
      ? t.create.duplicateProject
      : "";
  const githubError = draft.github.trim() && !profileLink(draft.github) ? t.create.invalidUrl : "";
  const demoError = draft.demo.trim() && !profileLink(draft.demo) ? t.create.invalidUrl : "";
  const invalid = Boolean(nameError || githubError || demoError);

  const addTech = (value: string) => {
    const tech = value.trim().replace(/,$/, "").trim();
    if (tech && !draft.tech.some((item) => item.toLowerCase() === tech.toLowerCase()))
      update("tech", [...draft.tech, tech]);
    setTechInput("");
  };

  const onImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      update("image", await readProjectImage(file));
    } catch {
      toast.error(t.create.imageError);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    // Keep a tech the user typed but didn't confirm with Enter.
    const pending = techInput.trim();
    if (invalid) return;
    onSave({
      ...draft,
      name,
      description: draft.description.trim(),
      tech:
        pending && !draft.tech.some((item) => item.toLowerCase() === pending.toLowerCase())
          ? [...draft.tech, pending]
          : draft.tech,
      github: draft.github.trim(),
      demo: draft.demo.trim(),
    });
  };

  const suggestions = skillSuggestions.filter(
    (skill) => !draft.tech.some((item) => item.toLowerCase() === skill.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{project ? t.create.editProject : t.create.addManual}</DialogTitle>
          <DialogDescription>{t.create.manualDesc}</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={submit} noValidate>
          <div>
            <Label htmlFor={ids.name}>{t.create.projectName}</Label>
            <Input
              id={ids.name}
              className="mt-2"
              value={draft.name}
              placeholder={t.create.projectNamePh}
              maxLength={80}
              aria-invalid={touched && Boolean(nameError)}
              aria-describedby={touched && nameError ? `${ids.name}-error` : undefined}
              onChange={(event) => update("name", event.target.value)}
            />
            {touched && nameError && (
              <p id={`${ids.name}-error`} className="mt-1.5 text-xs text-destructive">
                {nameError}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor={ids.description}>{t.create.projectDesc}</Label>
            <Textarea
              id={ids.description}
              className="mt-2 min-h-24"
              value={draft.description}
              placeholder={t.create.projectDescPh}
              maxLength={400}
              onChange={(event) => update("description", event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor={ids.tech}>{t.create.projectTech}</Label>
            <div className="mt-2 flex gap-2">
              <Input
                id={ids.tech}
                value={techInput}
                placeholder={t.create.projectTechPh}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value.endsWith(",")) addTech(value);
                  else setTechInput(value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTech(techInput);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label={t.create.add}
                disabled={!techInput.trim()}
                onClick={() => addTech(techInput)}
              >
                <Plus />
              </Button>
            </div>
            {draft.tech.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.tech.map((tech) => (
                  <button
                    type="button"
                    key={tech}
                    className="skill-chip flex items-center gap-1"
                    aria-label={t.create.removeTech(tech)}
                    onClick={() =>
                      update(
                        "tech",
                        draft.tech.filter((item) => item !== tech),
                      )
                    }
                  >
                    {tech}
                    <X className="size-3" />
                  </button>
                ))}
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{t.create.fromSkills}</span>
                {suggestions.map((skill) => (
                  <button
                    type="button"
                    key={skill}
                    className="filter-chip py-1"
                    onClick={() => addTech(skill)}
                  >
                    + {skill}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor={ids.image}>{t.create.projectImage}</Label>
            <div className="mt-2 flex items-center gap-4">
              <ProjectCover
                name={draft.name}
                image={draft.image}
                size="sm"
                className="aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-md border"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  id={ids.image}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => void onImage(event.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus />
                  {draft.image ? t.create.changeImage : t.create.chooseImage}
                </Button>
                {draft.image && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => update("image", "")}
                  >
                    <Trash2 />
                    {t.create.removeImage}
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t.create.projectImageHint}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {(
              [
                ["github", ids.github, t.create.projectRepo, t.create.projectRepoPh, githubError],
                ["demo", ids.demo, t.create.projectDemo, t.create.projectDemoPh, demoError],
              ] as const
            ).map(([key, id, label, placeholder, error]) => (
              <div key={key}>
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  className="mt-2"
                  inputMode="url"
                  value={draft[key]}
                  placeholder={placeholder}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(event) => update(key, event.target.value)}
                />
                {error && (
                  <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive">
                    {error}
                  </p>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t.create.cancel}
            </Button>
            <Button type="submit" disabled={touched && invalid}>
              {t.create.saveProject}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

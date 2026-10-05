import { Plus } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { canonicalSkill, hasSkill, suggestSkills } from "@/lib/skill-suggestions";
import { cn } from "@/lib/utils";

type Option = { name: string; isNew: boolean };

/**
 * Skill input that suggests the skills other profiles already use. When none fits, the typed one
 * can be added as new; once a profile with it is saved, it's suggested to everyone else too.
 */
export function SkillCombobox({
  id,
  catalog,
  chosen,
  onAdd,
  placeholder,
  invalid,
  describedBy,
}: {
  id: string;
  catalog: readonly string[];
  chosen: readonly string[];
  onAdd: (skill: string) => void;
  placeholder: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const { t } = useI18n();
  const listId = useId();
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const name = typed.trim();
  const options: Option[] = suggestSkills(catalog, typed, chosen).map((skill) => ({
    name: skill,
    isNew: false,
  }));
  // Offer the typed skill as new only when the catalog doesn't have it in any case.
  if (name && !hasSkill(catalog, name) && !hasSkill(chosen, name))
    options.push({ name, isNew: true });
  const expanded = open && options.length > 0;
  const optionId = (index: number) => `${listId}-${index}`;

  const add = (skill: string) => {
    const value = canonicalSkill(catalog, skill);
    if (value && !hasSkill(chosen, value)) onAdd(value);
    setTyped("");
    setActive(-1);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!options.length) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = expanded ? options[active] : undefined;
      if (option) add(option.name);
      else if (name) add(name);
    } else if (event.key === "Escape" && expanded) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div className="mt-2 flex gap-2">
      <div className="relative flex-1">
        <Input
          id={id}
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          aria-required="true"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label={t.create.skillSuggestions}
          hidden={!expanded}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-soft"
        >
          {options.map((option, index) => (
            <li
              key={`${option.isNew ? "new" : "skill"}-${option.name}`}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              // Keeps the focus in the input, so the blur doesn't close the list before the click.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(option.name)}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2",
                index === active && "bg-secondary",
                option.isNew && "text-primary",
              )}
            >
              {option.isNew && <Plus className="size-3.5 shrink-0" aria-hidden="true" />}
              {option.isNew ? t.create.addNewSkill(option.name) : option.name}
            </li>
          ))}
        </ul>
      </div>
      <Button type="button" onClick={() => add(name)} disabled={!name || hasSkill(chosen, name)}>
        <Plus />
        {t.create.add}
      </Button>
    </div>
  );
}

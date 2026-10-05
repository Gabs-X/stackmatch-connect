import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FieldError } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { brazilStates, citiesQuery, parseLocation } from "@/lib/cities";
import { useI18n } from "@/lib/i18n";

/** Only a city chosen from the IBGE list becomes a new saved location. */
export function LocationField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}) {
  const { t } = useI18n();
  const id = useId();
  const location = parseLocation(value);
  const [draftUf, setDraftUf] = useState("");
  const uf = location.uf || draftUf;
  const {
    data: cities = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    ...citiesQuery(uf),
    enabled: Boolean(uf),
  });
  const legacyCity = location.city && !cities.some((city) => city.nome === location.city);
  const selectClass =
    "mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
  const description = error ? `${id}-hint ${id}-error` : `${id}-hint`;

  return (
    <fieldset>
      <legend className="text-sm font-medium">
        {t.create.location}
        <span aria-hidden="true" className="ml-0.5 text-destructive">
          *
        </span>
      </legend>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${id}-state`}>{t.create.locationState}</Label>
          <select
            id={`${id}-state`}
            className={selectClass}
            value={uf}
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={description}
            onChange={(event) => {
              setDraftUf(event.target.value);
              onChange("");
            }}
          >
            <option value="">{t.create.selectPh}</option>
            {brazilStates.map(([code, name]) => (
              <option key={code} value={code}>
                {name} ({code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`${id}-city`}>{t.create.locationCity}</Label>
          <select
            id={`${id}-city`}
            className={selectClass}
            value={location.city}
            disabled={!uf || isPending || isError}
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={description}
            onChange={(event) => onChange(event.target.value ? `${event.target.value}, ${uf}` : "")}
          >
            <option value="">{uf && isPending ? t.common.loading : t.create.selectPh}</option>
            {/* Previously saved free text stays visible until the user chooses a new location. */}
            {legacyCity && <option value={location.city}>{location.city}</option>}
            {cities.map((city) => (
              <option key={city.id} value={city.nome}>
                {city.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p id={`${id}-hint`} className="mt-2 text-xs text-muted-foreground">
        {t.create.locationHint}
      </p>
      {uf && isPending && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {t.common.loading}
        </p>
      )}
      {isError && (
        <div role="alert" className="mt-2 text-sm text-destructive">
          <p>{t.create.locationLoadError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void refetch()}
          >
            {t.common.retry}
          </Button>
        </div>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </fieldset>
  );
}

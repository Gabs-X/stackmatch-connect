import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { brazilStates, citiesQuery } from "@/lib/cities";
import { useI18n } from "@/lib/i18n";
import { usePlaceLabel } from "@/lib/use-place-label";

/**
 * Picks the places of the Discover filter: a state, then one of its cities or the whole state.
 * The ones chosen show as chips that remove them.
 */
export function PlaceFilter({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const label = usePlaceLabel();
  const [uf, setUf] = useState("");
  const [city, setCity] = useState("");
  const {
    data: cities = [],
    isPending,
    isError,
  } = useQuery({
    ...citiesQuery(uf),
    enabled: Boolean(uf),
  });
  const place = city ? `${city}, ${uf}` : uf;
  const selectClass =
    "mt-1.5 h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
  const add = () => {
    if (!place || value.includes(place)) return;
    onChange([...value, place]);
    setCity("");
  };

  return (
    <div>
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
        <div>
          <Label htmlFor={`${id}-state`} className="text-xs">
            {t.create.locationState}
          </Label>
          <select
            id={`${id}-state`}
            className={selectClass}
            value={uf}
            onChange={(event) => {
              setUf(event.target.value);
              setCity("");
            }}
          >
            <option value="">—</option>
            {brazilStates.map(([code, name]) => (
              <option key={code} value={code} title={name}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`${id}-city`} className="text-xs">
            {t.create.locationCity}
          </Label>
          <select
            id={`${id}-city`}
            className={selectClass}
            value={city}
            disabled={!uf || isPending || isError}
            onChange={(event) => setCity(event.target.value)}
          >
            <option value="">{uf && isPending ? t.common.loading : t.filters.anyCity}</option>
            {cities.map((item) => (
              <option key={item.id} value={item.nome}>
                {item.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      {isError && <p className="mt-2 text-xs text-destructive">{t.create.locationLoadError}</p>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 w-full"
        disabled={!place || value.includes(place)}
        onClick={add}
      >
        <Plus />
        {t.filters.addPlace}
      </Button>
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((item) => (
            <button
              key={item}
              type="button"
              className="filter-chip filter-chip-active"
              aria-label={`${t.filters.remove}: ${label(item)}`}
              onClick={() => onChange(value.filter((other) => other !== item))}
            >
              {label(item)} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

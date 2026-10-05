import { ImagePlus, Trash2 } from "lucide-react";
import { useId, useRef } from "react";
import { toast } from "sonner";
import { DeveloperPhoto } from "@/components/developer-photo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { githubAvatarUrl } from "@/lib/developers";
import { useI18n } from "@/lib/i18n";
import { profileLink, readProfilePhoto } from "@/lib/local-profile";

/**
 * The profile photo in the form. Without an upload, the preview shows what the card will use
 * instead: the GitHub avatar, or the initials.
 */
export function ProfilePhotoField({
  name,
  photo,
  github,
  onChange,
}: {
  name: string;
  photo: string;
  github: string;
  onChange: (photo: string) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const shown = photo || (githubAvatarUrl(profileLink(github) ?? "") ?? "");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      onChange(await readProfilePhoto(file));
    } catch {
      toast.error(t.create.imageError);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="sm:col-span-2">
      <Label htmlFor={id}>{t.create.photo}</Label>
      <div className="mt-2 flex items-center gap-4">
        <DeveloperPhoto
          name={name || "?"}
          image={shown}
          alt={t.create.photoPreview}
          fallbackSize="lg"
          className="size-20 shrink-0 overflow-hidden rounded-full border"
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            id={id}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus />
            {photo ? t.create.changePhoto : t.create.choosePhoto}
          </Button>
          {photo && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <Trash2 />
              {t.create.removePhoto}
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t.create.photoHint}</p>
    </div>
  );
}

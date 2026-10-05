import { createFileRoute } from "@tanstack/react-router";
import { readLocalImage } from "@/server/storage";

/**
 * Serves the images kept in the local folder when there is no Blob store (development and tests).
 * With Vercel Blob, image URLs point to the store instead and nothing is served from here.
 */
export const Route = createFileRoute("/uploads/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const image = await readLocalImage(params._splat ?? "");
        if (!image) return new Response("Not found", { status: 404 });
        return new Response(new Uint8Array(image), {
          headers: {
            "content-type": "image/jpeg",
            // Each upload gets a new name, so a URL's image never changes.
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});

import fs from "node:fs";
import path from "node:path";

/**
 * Keeps only the candidates that actually exist in `public/`.
 *
 * This runs on the server while the page is statically generated, so a photo
 * dropped into `public/images/` is picked up on the next build without
 * triggering a 404 first. It must never be imported from a client component.
 */
export function resolveImageSources(...candidates: string[]): string[] {
  const publicDir = path.join(process.cwd(), "public");
  const existing = candidates.filter((src) => {
    if (!src.startsWith("/")) return true;

    // Resolve and confine to public/, so a crafted path cannot escape it.
    const target = path.resolve(publicDir, `.${src}`);
    if (!target.startsWith(publicDir)) return false;

    try {
      return fs.existsSync(target);
    } catch {
      return false;
    }
  });

  return existing.length > 0 ? existing : candidates.slice(-1);
}
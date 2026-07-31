import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

// Raster only. SVG omitted on purpose (can carry script); add if ever needed.
const IMAGE_MEDIA_TYPE_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

export class NotAnImageError extends Error {}

// Serve an on-disk file iff its REALPATH (post-symlink) is an allow-listed image.
// The extension check is the entire security bound — it is intentionally a
// content-type bound, not a location bound (so worktrees need no allowlist).
// realpath also throws for missing files, surfaced by the caller as 404.
export async function readImageFile(
  absolutePath: string,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; mediaType: string }> {
  const realTarget = await realpath(absolutePath);
  const mediaType = IMAGE_MEDIA_TYPE_BY_EXT[path.extname(realTarget).toLowerCase()];
  if (!mediaType) {
    throw new NotAnImageError(`refused non-image: ${realTarget}`);
  }
  const buffer = await readFile(realTarget);
  return { bytes: new Uint8Array(buffer), mediaType };
}

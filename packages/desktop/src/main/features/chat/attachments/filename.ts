// packages/desktop/src/main/features/chat/attachments/filename.ts
const EXT_BY_MEDIA_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
};

function extFromMediaType(mediaType: string): string {
  return EXT_BY_MEDIA_TYPE[mediaType] ?? ".bin";
}

/** Strip filesystem-unsafe bits; preserve spaces / @ / unicode. Traversal-safe. */
export function normalizeAttachmentName(rawName: string | undefined, mediaType: string): string {
  // Strip path separators (/ and \\). Collapse consecutive dots as traversal guard.
  // Spaces, @, unicode, and hyphens are preserved intentionally.
  let name = (rawName ?? "")
    .replace(/[/\\]/g, "")
    .replace(/\.{2,}/g, "")
    .trim();

  if (name === "" || name === "." || name === "..") {
    name = `pasted-image${extFromMediaType(mediaType)}`;
  } else if (!/\.[^.]+$/.test(name)) {
    name = `${name}${extFromMediaType(mediaType)}`;
  }

  // Truncate to 255 bytes, preserving the extension. A pathologically long tail
  // after the last dot is NOT treated as an extension — otherwise its byte length
  // could exceed 255, drive `budget` negative, and spin the trim loop forever.
  if (Buffer.byteLength(name, "utf8") > 255) {
    const dot = name.lastIndexOf(".");
    const rawExt = dot > 0 ? name.slice(dot) : "";
    const ext = Buffer.byteLength(rawExt, "utf8") <= 16 ? rawExt : "";
    const stem = ext ? name.slice(0, dot) : name;
    const budget = 255 - Buffer.byteLength(ext, "utf8");
    let truncated = stem;
    while (Buffer.byteLength(truncated, "utf8") > budget) {
      truncated = truncated.slice(0, -1);
    }
    name = truncated + ext;
  }

  return name;
}

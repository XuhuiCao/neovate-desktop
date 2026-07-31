import { constants } from "node:fs";
import { open } from "node:fs/promises";

/**
 * Append `line` to `targetAbsolutePath` exactly once (exact-line idempotency).
 * Self-contained; used only for git `info/exclude`. O_NOFOLLOW + fd-based reads
 * to avoid TOCTOU / symlink swaps. `line` is always a caller-fixed constant.
 */
export async function appendLineIdempotent(
  targetAbsolutePath: string,
  line: string,
): Promise<void> {
  const flags = constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW;
  const fh = await open(targetAbsolutePath, flags, 0o644);
  try {
    const st = await fh.stat();
    if (!st.isFile()) {
      throw new Error(`Refusing to write: ${targetAbsolutePath} is not a regular file`);
    }
    const buf = Buffer.alloc(st.size);
    if (st.size > 0) await fh.read(buf, 0, st.size, 0);
    const existing = buf.toString("utf8");

    if (
      existing
        .split("\n")
        .map((l) => l.trim())
        .includes(line.trim())
    ) {
      return;
    }

    const needsLeadingNewline = existing.length > 0 && !existing.endsWith("\n");
    const toAppend = (needsLeadingNewline ? "\n" : "") + line + "\n";
    await fh.write(toAppend, st.size, "utf8");
  } finally {
    await fh.close();
  }
}

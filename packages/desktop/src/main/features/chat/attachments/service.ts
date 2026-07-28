// packages/desktop/src/main/features/chat/attachments/service.ts
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import simpleGit from "simple-git";

import type {
  AttachmentErrorCode,
  SaveAttachmentResult,
} from "../../../../shared/features/chat/attachments/contract";

import { appendLineIdempotent } from "./append-line";
import { normalizeAttachmentName } from "./filename";

const CONTEXT_DIR = ".neo/.context";
const ATTACHMENTS_SEGMENT = `${CONTEXT_DIR}/attachments`;
const EXCLUDE_LINE = `${CONTEXT_DIR}/`;

export class AttachmentServiceError extends Error {
  constructor(
    public readonly code: AttachmentErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AttachmentServiceError";
  }
}

type SaveInput = {
  cwd: string;
  type: "image";
  name?: string;
  mediaType: string;
  file: Blob;
};

export class AttachmentService {
  /** Keyed by the resolved exclude-file path (shared across worktrees), so the
   *  line is ensured exactly once even from different worktree roots. */
  private excludeEnsured = new Map<string, Promise<void>>();

  async save(input: SaveInput): Promise<SaveAttachmentResult> {
    if (!input.mediaType.startsWith("image/")) {
      throw new AttachmentServiceError(
        "invalid_media_type",
        `unsupported mediaType: ${input.mediaType}`,
      );
    }

    const root = await this.resolveRoot(input.cwd);
    await this.ensureExcludedOnce(input.cwd);

    const attachmentId = randomBytes(6).toString("base64url");
    const name = normalizeAttachmentName(input.name, input.mediaType);
    const dir = path.join(root, ATTACHMENTS_SEGMENT, attachmentId);
    const absolutePath = path.join(dir, name);

    try {
      const buffer = Buffer.from(await input.file.arrayBuffer());
      await mkdir(dir, { recursive: true });
      await writeFile(absolutePath, buffer);
    } catch (e) {
      throw new AttachmentServiceError("write_failed", String(e));
    }

    return { attachmentId, absolutePath, name };
  }

  /** git toplevel, or cwd when not a repo. Never runs `git init`.
   *  Uses --show-cdup (relative offset from cwd to root) applied to cwd
   *  so the returned path preserves any symlinks in cwd, rather than the
   *  realpath that --show-toplevel emits. This keeps paths consistent with
   *  what the caller passed in (important on macOS where /tmp → /private/tmp). */
  private async resolveRoot(cwd: string): Promise<string> {
    try {
      const cdup = (await simpleGit(cwd).revparse(["--show-cdup"])).trim();
      // --show-cdup is empty string when cwd IS the root; otherwise a relative path like "../../"
      return path.resolve(cwd, cdup || ".");
    } catch {
      return cwd;
    }
  }

  private async ensureExcludedOnce(cwd: string): Promise<void> {
    let excludePath: string;
    try {
      const raw = (await simpleGit(cwd).revparse(["--git-path", "info/exclude"])).trim();
      if (!raw) return; // not a repo
      excludePath = path.resolve(cwd, raw);
    } catch {
      return; // not a repo → skip (never git init)
    }
    const existing = this.excludeEnsured.get(excludePath);
    if (existing) return existing;
    const p = appendLineIdempotent(excludePath, EXCLUDE_LINE).catch(() => {
      // best-effort: exclude failures must not fail the save
    });
    this.excludeEnsured.set(excludePath, p);
    return p;
  }
}

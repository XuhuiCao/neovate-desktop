// packages/desktop/src/main/features/chat/attachments/__tests__/service.test.ts
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import simpleGit from "simple-git";
import { describe, expect, it } from "vitest";

import { AttachmentService, AttachmentServiceError } from "../service";

async function tmp(): Promise<string> {
  return mkdtemp(join(tmpdir(), "neo-att-"));
}
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const pngBlob = () => new Blob([PNG], { type: "image/png" });

// Spawns real `git` (init / worktree add / rev-parse) in every save; raise the
// timeout so these don't flake as ~5s timeouts under parallel CI load.
describe("AttachmentService.save", { timeout: 20_000 }, () => {
  it("writes bytes under .neo/.context/attachments/<id>/<name> at git root", async () => {
    const root = await tmp();
    await simpleGit(root).init();
    const svc = new AttachmentService();
    const r = await svc.save({
      cwd: root,
      type: "image",
      name: "a b.png",
      mediaType: "image/png",
      file: pngBlob(),
    });

    expect(r.name).toBe("a b.png");
    expect(r.absolutePath).toMatch(/\/\.neo\/\.context\/attachments\/[^/]+\/a b\.png$/);
    expect(r.absolutePath.startsWith(root)).toBe(true);
    expect(new Uint8Array(await readFile(r.absolutePath))).toEqual(PNG);
  });

  it("adds .neo/.context/ to info/exclude exactly once under concurrency", async () => {
    const root = await tmp();
    await simpleGit(root).init();
    const svc = new AttachmentService();
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        svc.save({
          cwd: root,
          type: "image",
          name: `x${i}.png`,
          mediaType: "image/png",
          file: pngBlob(),
        }),
      ),
    );
    const exclude = await readFile(join(root, ".git", "info", "exclude"), "utf8");
    expect(exclude.split("\n").filter((l) => l.trim() === ".neo/.context/")).toHaveLength(1);
  });

  it("two worktrees sharing one common-dir exclude get the line once", async () => {
    const main = await tmp();
    const git = simpleGit(main);
    await git.init();
    await git.addConfig("user.email", "test@test.local");
    await git.addConfig("user.name", "Test");
    await git.raw(["commit", "--allow-empty", "-m", "init"]);
    const wt = join(await tmp(), "wt");
    await git.raw(["worktree", "add", "-b", "feat", wt]);
    const svc = new AttachmentService();
    await svc.save({
      cwd: main,
      type: "image",
      name: "a.png",
      mediaType: "image/png",
      file: pngBlob(),
    });
    await svc.save({
      cwd: wt,
      type: "image",
      name: "b.png",
      mediaType: "image/png",
      file: pngBlob(),
    });
    const exclude = await readFile(join(main, ".git", "info", "exclude"), "utf8");
    expect(exclude.split("\n").filter((l) => l.trim() === ".neo/.context/")).toHaveLength(1);
  });

  it("falls back to cwd and skips exclude when not a git repo", async () => {
    const root = await tmp();
    const svc = new AttachmentService();
    const r = await svc.save({
      cwd: root,
      type: "image",
      name: "n.png",
      mediaType: "image/png",
      file: pngBlob(),
    });
    expect(r.absolutePath.startsWith(join(root, ".neo", ".context"))).toBe(true);
    await expect(stat(join(root, ".git"))).rejects.toThrow(); // no git init happened
  });

  it("throws invalid_media_type for non-image", async () => {
    const root = await tmp();
    const svc = new AttachmentService();
    await expect(
      svc.save({
        cwd: root,
        type: "image",
        name: "x.txt",
        mediaType: "text/plain",
        file: new Blob([PNG], { type: "text/plain" }),
      }),
    ).rejects.toMatchObject({ code: "invalid_media_type" } as Partial<AttachmentServiceError>);
  });
});

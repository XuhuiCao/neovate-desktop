import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { appendLineIdempotent } from "../append-line";

let dirs: string[] = [];
async function tmp(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "neo-append-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  dirs = [];
});

describe("appendLineIdempotent", () => {
  it("creates the file and appends the line", async () => {
    const dir = await tmp();
    const target = join(dir, "exclude");
    await appendLineIdempotent(target, ".neo/.context/");
    expect(await readFile(target, "utf8")).toBe(".neo/.context/\n");
  });

  it("is idempotent across repeated calls", async () => {
    const dir = await tmp();
    const target = join(dir, "exclude");
    await appendLineIdempotent(target, ".neo/.context/");
    await appendLineIdempotent(target, ".neo/.context/");
    await appendLineIdempotent(target, ".neo/.context/");
    expect(await readFile(target, "utf8")).toBe(".neo/.context/\n");
  });

  it("prefixes a newline when existing content has none", async () => {
    const dir = await tmp();
    const target = join(dir, "exclude");
    await writeFile(target, "*.log");
    await appendLineIdempotent(target, ".neo/.context/");
    expect(await readFile(target, "utf8")).toBe("*.log\n.neo/.context/\n");
  });

  it("rejects a symlink target (ELOOP)", async () => {
    const dir = await tmp();
    const real = join(dir, "real");
    const link = join(dir, "exclude");
    await writeFile(real, "");
    await symlink(real, link);
    await expect(appendLineIdempotent(link, ".neo/.context/")).rejects.toThrow();
  });
});

import os from "node:os";
import { describe, it, expect, vi } from "vitest";

vi.mock("@electron-toolkit/utils", () => ({
  is: { dev: true },
}));

import { resolveClaudeCodeExecutable } from "../claude-code-utils";

describe("resolveClaudeCodeExecutable", () => {
  it("returns bundled SDK defaults when no custom path", () => {
    const result = resolveClaudeCodeExecutable();
    // SDK 0.3.x: prefer the bundled platform `claude` binary (standalone) on
    // macOS; otherwise fall back to `bun + cli.js` or PATH `claude`.
    expect(result.executable).toBeDefined();
    if (result.standalone) {
      expect(result.cliPath).toBeUndefined();
    } else {
      expect(result.cliPath).toBeDefined();
    }
  });

  it("returns bundled SDK defaults for empty string", () => {
    const result = resolveClaudeCodeExecutable("");
    expect(result.executable).toBeDefined();
    if (result.standalone) {
      expect(result.cliPath).toBeUndefined();
    } else {
      expect(result.cliPath).toBeDefined();
    }
  });

  it("uses bun + custom cliPath for .js paths", () => {
    const result = resolveClaudeCodeExecutable("/custom/path/cli.js");
    expect(result.standalone).toBe(false);
    expect(result.cliPath).toBe("/custom/path/cli.js");
  });

  it("returns standalone for non-.js paths", () => {
    const result = resolveClaudeCodeExecutable("/usr/local/bin/claude");
    expect(result.standalone).toBe(true);
    expect(result.executable).toBe("/usr/local/bin/claude");
    expect(result.cliPath).toBeUndefined();
  });

  it("expands ~ to homedir", () => {
    const result = resolveClaudeCodeExecutable("~/bin/claude");
    expect(result.standalone).toBe(true);
    expect(result.executable).toBe(`${os.homedir()}/bin/claude`);
  });

  it("trims whitespace", () => {
    const result = resolveClaudeCodeExecutable("  /usr/local/bin/claude  ");
    expect(result.executable).toBe("/usr/local/bin/claude");
  });

  it("treats whitespace-only as empty (bundled default)", () => {
    const result = resolveClaudeCodeExecutable("   ");
    expect(result.executable).toBeDefined();
    if (result.standalone) {
      expect(result.cliPath).toBeUndefined();
    } else {
      expect(result.cliPath).toBeDefined();
    }
  });
});

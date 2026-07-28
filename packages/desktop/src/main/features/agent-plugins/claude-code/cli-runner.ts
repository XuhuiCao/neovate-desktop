import { spawn } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export type SpawnClaudeCliOpts = {
  claudeBinary: string;
  args: string[];
  cwd: string;
  /** Default 60_000 ms. Marketplace clone may need longer; callers can bump. */
  timeoutMs?: number;
  /** Extra env vars; HOME is inherited from process.env unless overridden. */
  env?: NodeJS.ProcessEnv;
};

export type SpawnClaudeCliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export class ClaudeCliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly args: string[],
  ) {
    super(message);
    this.name = "ClaudeCliError";
  }
}

/**
 * Spawn the `claude` CLI with the given args, capture stdout/stderr,
 * enforce timeout, and reject with a typed error on non-zero exit.
 *
 * Failure handling: we ALWAYS prefer exit code (§3.4 / spec). stdout text
 * parsing is unreliable.
 */
export function spawnClaudeCli(opts: SpawnClaudeCliOpts): Promise<SpawnClaudeCliResult> {
  const timeoutMs = opts.timeoutMs ?? 60_000;

  return new Promise<SpawnClaudeCliResult>((resolve, reject) => {
    // Capture stdout to a temp FILE, not a pipe. The bundled `claude` is a Bun
    // single-file executable that writes its whole stdout in one async write and
    // can exit before flushing past the ~64KB kernel pipe buffer — silently
    // truncating large JSON outputs (e.g. a marketplace manifest with many
    // plugins). The dropped bytes never reach the pipe, so no reader-side fix (bigger
    // highWaterMark, larger maxBuffer, streaming) recovers them; a file fd never
    // blocks, so the child's single write always completes. stderr stays a pipe:
    // it is always small and we surface it in error messages.
    const dir = mkdtempSync(path.join(tmpdir(), "neo-claude-cli-"));
    const stdoutPath = path.join(dir, "stdout");
    const stdoutFd = openSync(stdoutPath, "w");

    let stderr = "";
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Read the captured stdout, release the temp dir, and invoke `cb` exactly
    // once. A timeout SIGKILL still produces a later `close`, so guard. The
    // stdout fd is released right after spawn (see below), NOT here — holding a
    // raw numeric fd open across the child's lifetime is the fd footgun this
    // hardening removes.
    const settle = (cb: (stdout: string) => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      let stdout = "";
      try {
        stdout = readFileSync(stdoutPath, "utf8");
      } catch {}
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {}
      cb(stdout);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(opts.claudeBinary, opts.args, {
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        stdio: ["ignore", stdoutFd, "pipe"],
      });
    } catch (err) {
      // Synchronous spawn failure (e.g. a concurrent-spawn EBADF): settle()
      // never runs without a child, so release the fd + temp dir here and reject.
      try {
        closeSync(stdoutFd);
      } catch {}
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {}
      reject(
        new ClaudeCliError(
          `claude CLI spawn error: ${err instanceof Error ? err.message : String(err)}`,
          null,
          "",
          stderr,
          opts.args,
        ),
      );
      return;
    }

    // The child holds its own dup of the fd; release the parent copy immediately
    // (same synchronous tick as spawn) so it can never be involved in a later
    // concurrent-spawn fd race. stdout stays captured to the FILE (no ~64KB pipe
    // truncation for the Bun claude exe); settle() reads it after the child exits.
    try {
      closeSync(stdoutFd);
    } catch {}

    // setEncoding decodes stderr as UTF-8 across chunk boundaries (multi-byte
    // chars never corrupted); stdout is read from the file once, fully decoded.
    // stderr is always a pipe here, but passing a numeric fd for stdout widens
    // the stdio tuple so TS can no longer prove the stream is non-null.
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (s: string) => (stderr += s));

    timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle((stdout) =>
        reject(
          new ClaudeCliError(
            `claude CLI timeout after ${timeoutMs}ms`,
            null,
            stdout,
            stderr,
            opts.args,
          ),
        ),
      );
    }, timeoutMs);

    child.on("error", (err) => {
      settle((stdout) =>
        reject(
          new ClaudeCliError(
            `claude CLI spawn error: ${err.message}`,
            null,
            stdout,
            stderr,
            opts.args,
          ),
        ),
      );
    });

    child.on("close", (code) => {
      settle((stdout) => {
        if (code === 0) {
          resolve({ exitCode: 0, stdout, stderr });
        } else {
          // Include stderr in message so the text survives oRPC serialization
          // and appears in the renderer's error toast without special handling.
          const detail = stderr.trim() || stdout.trim();
          reject(
            new ClaudeCliError(
              `claude CLI exited ${code} (${opts.args.join(" ")})${detail ? `\n${detail}` : ""}`,
              code,
              stdout,
              stderr,
              opts.args,
            ),
          );
        }
      });
    });
  });
}

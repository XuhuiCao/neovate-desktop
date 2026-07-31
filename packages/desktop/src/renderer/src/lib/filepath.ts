// ─── Internal regexes ───────────────────────────────────────────────────────

// Deliberately excludes whitespace and `#`:
//   - whitespace: prose like `look at /tmp/foo.ts` is not a path token
//   - `#`: anchor fragments belong to the link, not the filename. The position
//     suffix `#L\d+[C\d+]` is stripped by HASH_LOC_RE before extension matching,
//     so any other `#…` makes the input fall through to the <a> renderer.
// ` -￿` admits non-ASCII filename characters (CJK, accented Latin, …)
// that `\w` alone drops — the range spans the full BMP above ASCII plus surrogate
// halves, so astral-plane characters match as their code-unit pairs.
const PATH_CHAR = "[\\w/.~@\\u00A0-\\uFFFF-]";

const EXTENSIONS = [
  // JS/TS ecosystem
  "tsx?",
  "jsx?",
  "mjs",
  "cjs",
  // mainstream languages
  "py",
  "rs",
  "go",
  "rb",
  "java",
  "kt",
  "swift",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "php",
  "sh",
  "sql",
  // web / markup
  "css",
  "scss",
  "html",
  "xml",
  "svg",
  "vue",
  "svelte",
  "astro",
  "md",
  "mdx",
  // data / config
  "json",
  "jsonl",
  "ndjson",
  "ya?ml",
  "toml",
  "lock",
  "graphql",
  "prisma",
  // .env, .env.local, .env.production, …
  "env(?:\\.\\w+)?",
  // common dotfiles — treated as the "extension" portion of `.zshrc` etc.
  "zshrc",
  "bashrc",
  "gitignore",
  "gitattributes",
  "editorconfig",
  "npmrc",
  "prettierrc",
  "dockerignore",
];

const FILE_EXT_RE = new RegExp(
  `^(${PATH_CHAR}+\\.(?:${EXTENSIONS.join("|")})|\\.env(?:\\.\\w+)?)$`,
);

/** Anything matching `scheme://` is not a local path. */
const URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const URI_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/** `:line[:col][-line[:col]]` — accepts ASCII hyphen or en-dash. Range end is dropped. */
const COLON_LOC_RE = /:(\d+)(?::(\d+))?(?:[-–]\d+(?::\d+)?)?$/;

/** GitHub anchor form `#L<n>[C<n>][-L<n>[C<n>]]`. Wins over colon form. Range end dropped. */
const HASH_LOC_RE = /#L(\d+)(?:C(\d+))?(?:-L\d+(?:C\d+)?)?$/;

/**
 * `.env`-family suffix (`.env`, `.env.local`, `process.env`). Used to keep BARE
 * single-segment tokens of this shape rejected: `process.env` / `import.meta.env`
 * are overwhelmingly code, not files. A real `.env` file written with an explicit
 * path prefix (`./.env`, `~/.env`, `/proj/.env.local`) is unaffected.
 */
const BARE_ENV_RE = /(?:^|\.)env(?:\.\w+)?$/;

// ─── Internal helpers ───────────────────────────────────────────────────────

interface LocationStart {
  body: string;
  row: number;
  col: number | undefined;
}

function parseLocationSuffix(text: string): LocationStart | null {
  const hash = HASH_LOC_RE.exec(text);
  if (hash) {
    return {
      body: text.slice(0, hash.index),
      row: Number(hash[1]),
      col: hash[2] ? Number(hash[2]) : undefined,
    };
  }
  const colon = COLON_LOC_RE.exec(text);
  if (colon) {
    return {
      body: text.slice(0, colon.index),
      row: Number(colon[1]),
      col: colon[2] ? Number(colon[2]) : undefined,
    };
  }
  return null;
}

/**
 * Normalize a path body to an absolute form.
 *
 * Lexical only — no realpath, no `../` collapsing, no FS access. Returns
 * `null` when the input cannot be made absolute given the available options
 * (e.g. relative input with no cwd, `~/` with no homedir).
 */
function normalizeToAbsolute(body: string, options: ParseOptions): string | null {
  if (body.startsWith("/")) return body;

  if (body.startsWith("~/") || body === "~") {
    if (!options.homedir) return null;
    return body.replace(/^~/, options.homedir);
  }

  if (body.startsWith("./") || body.startsWith("../")) {
    if (!options.cwd || !options.cwd.startsWith("/")) return null;
    const cleanCwd = options.cwd.replace(/\/+$/, "");
    const stripped = body.startsWith("./") ? body.slice(2) : body;
    return cleanCwd === "" ? `/${stripped}` : `${cleanCwd}/${stripped}`;
  }

  // Workspace-relative (`src/foo.ts`) or bare root-level filename (`README.md`):
  // resolve against cwd. Bare `.env`-family tokens stay rejected (see BARE_ENV_RE)
  // since they're almost always code references, not files.
  if (!options.cwd || !options.cwd.startsWith("/")) return null;
  if (!body.includes("/") && BARE_ENV_RE.test(body)) return null;
  const cleanCwd = options.cwd.replace(/\/+$/, "");
  return cleanCwd === "" ? `/${body}` : `${cleanCwd}/${body}`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface ParseOptions {
  /** Workspace root. Required for `./`, `../`, and workspace-relative (`src/foo.ts`). */
  cwd?: string;
  /** Home directory. Required for `~/foo.ts`. */
  homedir?: string;
}

export interface FilePathInfo {
  /** Normalized absolute path (no location suffix). */
  absolute: string;
  /** The cwd that was used for normalization (echoed from options). */
  cwd: string | undefined;
  /** 1-based line number — present only when input had a position suffix. */
  row: number | undefined;
  /** 1-based column number — present only when input had a column suffix. */
  col: number | undefined;
}

/**
 * Detect a file path the markdown renderer should turn into a button.
 * Returns `null` for anything that isn't an unambiguously resolvable local
 * path — URLs, prose, or relative inputs without the cwd / homedir needed to
 * normalize them.
 *
 * Accepts (when body matches a known file extension):
 *   - absolute        `/abs/foo.ts`
 *   - home-relative   `~/foo.ts`               (needs `homedir`)
 *   - explicit rel.   `./foo.ts`, `../foo.ts`  (need `cwd`)
 *   - workspace rel.  `src/foo.ts`             (needs `cwd`)
 *   - bare filename   `README.md`              (needs `cwd`; resolved at its root)
 *
 * Each may carry a position suffix `:L[:C]` or `#L<n>[C<n>]`. Range syntax
 * (`:42-48`, `#L42-L48`) is tolerated at parse time but only the START
 * position is exposed via `row`/`col`.
 *
 * Rejected:
 *   - URLs (`scheme://...`)
 *   - protocol-relative or malformed double-slash (`//...`)
 *   - bare `.env`-family tokens (`process.env` — code, not a file)
 */
export function isFilePath(text: string): boolean {
  return parseFilePath(text) !== null;
}

export function parseFilePath(text: string, options: ParseOptions = {}): FilePathInfo | null {
  if (text.startsWith("//")) return null;
  if (URL_RE.test(text)) return null;

  const loc = parseLocationSuffix(text);
  const body = loc ? loc.body : text;

  if (!FILE_EXT_RE.test(body)) return null;

  const absolute = normalizeToAbsolute(body, options);
  if (absolute === null) return null;

  return {
    absolute,
    cwd: options.cwd,
    row: loc?.row,
    col: loc?.col,
  };
}

function decodeLinkHref(href: string): string | null {
  try {
    return decodeURIComponent(href);
  } catch {
    return null;
  }
}

/** Whether an explicit Markdown href declares a local target, even if cwd is unavailable. */
export function isLocalFileLink(href: string): boolean {
  const decoded = decodeLinkHref(href);
  if (!decoded || decoded.startsWith("#") || decoded.startsWith("//")) return false;
  if (parseFilePath(decoded, { cwd: "/", homedir: "/" })) return true;
  return !URI_SCHEME_RE.test(decoded);
}

/**
 * Resolve an explicit Markdown link that has local-path syntax. Unlike
 * `parseFilePath`, this does not apply the inline-code extension whitelist:
 * explicit links already declare intent and may target images or extensionless
 * files. URLs, protocol-relative links, and hash-only links remain non-local.
 */
export function resolveLocalFileLink(href: string, options: ParseOptions = {}): string | null {
  const decoded = decodeLinkHref(href);
  if (!decoded || decoded.startsWith("#") || decoded.startsWith("//")) return null;

  const parsedCandidate = parseFilePath(decoded, options);
  if (parsedCandidate) return parsedCandidate.absolute;
  if (URI_SCHEME_RE.test(decoded)) return null;

  const location = parseLocationSuffix(decoded);
  const target = location?.body ?? decoded;
  if (!target || target.includes("?") || target.includes("#")) return null;
  if (target.startsWith("/")) return target;

  if (target === "~" || target.startsWith("~/")) {
    if (!options.homedir) return null;
    return target.replace(/^~/, options.homedir);
  }

  if (!options.cwd || !options.cwd.startsWith("/")) return null;
  const cleanCwd = options.cwd.replace(/\/+$/, "");
  const stripped = target.startsWith("./") ? target.slice(2) : target;
  return cleanCwd === "" ? `/${stripped}` : `${cleanCwd}/${stripped}`;
}

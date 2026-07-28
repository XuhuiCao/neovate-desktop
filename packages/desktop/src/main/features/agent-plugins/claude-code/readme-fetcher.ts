import debug from "debug";

const log = debug("neovate:dev-workflow:readme-fetcher");

const FETCH_TIMEOUT_MS = 8_000;
// 1 MB cap on the README string itself (both github + npm paths). Each path
// reads the full response via `res.text()` before checking the cap. The source
// URLs come from our curated marketplace.json (github.com, or the allowlisted
// npm registry whose /latest docs are a few KB in practice), so we're
// bounding accidental megabyte READMEs, not defending against an adversarial
// unbounded response.
const MAX_README_BYTES = 1024 * 1024;
// Open-source adaptation: defer to the public npm registry instead of the
// internal Ant Group mirror.
const NPM_REGISTRY_ALLOWLIST = new Set(["registry.npmjs.org"]);

/**
 * Subset of `marketplace.json` plugin source shapes we care about. The on-disk
 * schema in `marketplace-manifest.ts` keeps `source` as `z.unknown()`; we
 * runtime-narrow it here. `{ source: "url", url, sha? }` (github only) and
 * `{ source: "npm", package, registry? }` (allowlisted registry only) trigger a
 * remote fetch — everything else returns null (e.g. `directory` sources are
 * read from disk; we don't need that for the marketplace use case).
 */
type ReadmeSource = unknown;

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const ssh = url.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (ssh) return { owner: ssh[1], repo: ssh[2] };
  const https = url.match(/^https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/);
  if (https) return { owner: https[1], repo: https[2] };
  return null;
}

function isUrlSource(s: ReadmeSource): s is { source: "url"; url: string; sha?: string } {
  return (
    typeof s === "object" &&
    s !== null &&
    (s as { source?: unknown }).source === "url" &&
    typeof (s as { url?: unknown }).url === "string"
  );
}

async function fetchGithubReadme(owner: string, repo: string, ref: string): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/README.md`;
  log("fetchGithubReadme: %s", url);
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`README_FETCH_FAILED ${res.status} ${url}`);
  const text = await res.text();
  if (Buffer.byteLength(text) > MAX_README_BYTES) {
    throw new Error(`README_TOO_LARGE ${Buffer.byteLength(text)}`);
  }
  return text;
}

function isNpmSource(s: ReadmeSource): s is { source: "npm"; package: string; registry?: string } {
  return (
    typeof s === "object" &&
    s !== null &&
    (s as { source?: unknown }).source === "npm" &&
    typeof (s as { package?: unknown }).package === "string"
  );
}

// scoped `@scope/name` -> `@scope%2Fname`; unscoped unchanged.
function encodeNpmPackage(pkg: string): string {
  return pkg.startsWith("@") ? pkg.replace("/", "%2F") : pkg;
}

async function fetchNpmReadme(pkg: string, registry?: string): Promise<string | null> {
  let host: string | null = null;
  try {
    host = registry ? new URL(registry).hostname : null;
  } catch {
    host = null;
  }
  if (!host || !NPM_REGISTRY_ALLOWLIST.has(host)) {
    throw new Error(`UNSUPPORTED_NPM_REGISTRY: ${registry ?? "<missing>"}`);
  }
  const base = registry!.replace(/\/+$/, "");
  const url = `${base}/${encodeNpmPackage(pkg)}/latest`;
  log("fetchNpmReadme: %s", url);
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`README_FETCH_FAILED ${res.status} ${url}`);
  // The /latest doc embeds the README as a string field alongside package
  // metadata. Read it whole (curated registry, KB-sized docs in practice) and
  // pull out `.readme`, capping the README itself the same way the github path
  // does.
  const text = await res.text();
  let readme: unknown;
  try {
    readme = (JSON.parse(text) as { readme?: unknown }).readme;
  } catch {
    return null;
  }
  if (typeof readme !== "string" || readme.length === 0) return null;
  if (Buffer.byteLength(readme) > MAX_README_BYTES) return null;
  return readme;
}

/**
 * Dispatch a marketplace.json `source` to the right host fetcher. Returns:
 *   - markdown string on success
 *   - null when the README simply doesn't exist (404, non-url source, etc.)
 *   - throws `UNSUPPORTED_README_HOST` for non-github url hosts
 *   - throws `UNSUPPORTED_NPM_REGISTRY` for non-allowlisted or missing npm registries
 */
export async function fetchReadmeFromSource(source: ReadmeSource): Promise<string | null> {
  if (isUrlSource(source)) {
    const gh = parseGithubUrl(source.url);
    if (gh) return fetchGithubReadme(gh.owner, gh.repo, source.sha ?? "HEAD");
    throw new Error(`UNSUPPORTED_README_HOST: ${source.url}`);
  }
  if (isNpmSource(source)) return fetchNpmReadme(source.package, source.registry);
  return null;
}

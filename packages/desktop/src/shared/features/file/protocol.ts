// packages/desktop/src/shared/features/file/protocol.ts
// Generic local-file scheme: serves on-disk image files to the renderer via
// <img src>, so the browser fetches+caches natively (no oRPC blob / object URL).
// Bound is content-type (image extension on realpath), enforced in the main handler.
export const NEO_FILE_SCHEME = "neo-file";
export const NEO_FILE_HOST = "neo-app"; // fixed synthetic origin marker (cf. vscode-app)

// Whole-path encodeURIComponent keeps it cross-platform (Windows drive/backslash,
// spaces, @, #, %). Decoded back in the handler via URL(...).pathname.
export function buildNeoFileSchemeUrl(absolutePath: string): string {
  return `${NEO_FILE_SCHEME}://${NEO_FILE_HOST}/${encodeURIComponent(absolutePath)}`;
}

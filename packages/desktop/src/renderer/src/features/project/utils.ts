/**
 * Path-segment-aware "is within" check. Prevents `/foo/d2c` from matching
 * sibling `/foo/d2ctest` the way naive `startsWith` would.
 */
export function isPathWithin(cwd: string, base: string): boolean {
  return cwd === base || cwd.startsWith(base.endsWith("/") ? base : base + "/");
}

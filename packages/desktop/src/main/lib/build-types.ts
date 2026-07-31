import semver from "semver";

export const BUILD_TYPES = ["dev", "stable", "insider"] as const;
export type BuildType = (typeof BUILD_TYPES)[number];

/**
 * electron-updater channel for a given version string: the first prerelease
 * identifier if it's a string name, else "latest".
 *
 *   "0.8.3-add-insider.1" -> "add-insider"
 *   "0.8.3"               -> "latest"
 *   "0.8.3-1"             -> "latest"  (a bare numeric prerelease is not a channel)
 */
export function channelFromVersion(version: string): string {
  const id = semver.parse(version)?.prerelease[0];
  return typeof id === "string" && id.length > 0 ? id : "latest";
}

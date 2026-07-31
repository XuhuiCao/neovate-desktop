/**
 * Runtime feature flag for the parallel router-based chat world.
 *
 * Set NEO_FLAG_ROUTER_CHAT=1 at launch. Main decides (double-gated with
 * __BUILD_TYPE__ !== "stable") and passes the decision to the renderer through
 * the preload bridge — `window.api.neoFlagRouterChat` — NOT a URL query. A query is
 * lost whenever the main window does a full reload (e.g. the auth/SSO
 * round-trip), whereas the preload re-applies it on every load. Read once at
 * module load, before the router first renders. `window.api` is undefined in
 * the jsdom test environment, so the optional chain keeps the flag false there.
 */
export const NEO_FLAG_ROUTER_CHAT =
  typeof window !== "undefined" && window.api?.neoFlagRouterChat === true;

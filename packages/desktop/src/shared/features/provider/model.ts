import type { Provider } from "./types";

/**
 * The default model id for a provider: its configured `modelMap.model`, or the
 * first key in its catalog as a fallback. Pure (no node deps) so both the main
 * and renderer processes can import it — single source for the expression that
 * otherwise drifts across provider/model resolution sites.
 */
export function providerDefaultModel(provider: Provider): string {
  return provider.modelMap.model ?? Object.keys(provider.models)[0];
}

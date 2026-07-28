import { createChangesStore, type ChangesStore } from "./store";

let storeSingleton: ChangesStore | null = null;

function getStore(): ChangesStore {
  if (!storeSingleton) storeSingleton = createChangesStore();
  return storeSingleton;
}

/** Access the singleton store from non-React code (e.g. click handlers). */
export function getChangesStore(): ChangesStore {
  return getStore();
}

/** Test-only */
export function __resetChangesStoreForTests(): void {
  storeSingleton = null;
}

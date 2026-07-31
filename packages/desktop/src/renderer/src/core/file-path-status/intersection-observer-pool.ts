export const FILE_PATH_OBSERVER_OPTIONS: IntersectionObserverInit = {
  root: null,
  rootMargin: "200px 0px",
  threshold: 0,
};

type Listener = (nearViewport: boolean) => void;

export interface IntersectionObserverLike {
  observe(element: Element): void;
  unobserve(element: Element): void;
  disconnect(): void;
}

export type IntersectionObserverFactory = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit,
) => IntersectionObserverLike;

export interface IntersectionObserverPool {
  observe(element: Element, listener: Listener): () => void;
  reset(): void;
}

export function createIntersectionObserverPool(
  factory?: IntersectionObserverFactory,
): IntersectionObserverPool {
  const listeners = new Map<Element, Set<Listener>>();
  let observer: IntersectionObserverLike | null = null;

  const createObserver = (): IntersectionObserverLike | null => {
    if (factory) return factory(handleEntries, FILE_PATH_OBSERVER_OPTIONS);
    if (typeof IntersectionObserver === "undefined") return null;
    return new IntersectionObserver(handleEntries, FILE_PATH_OBSERVER_OPTIONS);
  };

  function handleEntries(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      for (const listener of listeners.get(entry.target) ?? []) {
        listener(entry.isIntersecting);
      }
    }
  }

  return {
    observe(element, listener) {
      observer ??= createObserver();
      if (!observer) {
        listener(true);
        return () => {};
      }

      let elementListeners = listeners.get(element);
      if (!elementListeners) {
        elementListeners = new Set();
        listeners.set(element, elementListeners);
        observer.observe(element);
      }
      elementListeners.add(listener);

      return () => {
        const current = listeners.get(element);
        if (!current) return;
        current.delete(listener);
        if (current.size > 0) return;

        listeners.delete(element);
        observer?.unobserve(element);
        if (listeners.size === 0) {
          observer?.disconnect();
          observer = null;
        }
      };
    },

    reset() {
      observer?.disconnect();
      observer = null;
      listeners.clear();
    },
  };
}

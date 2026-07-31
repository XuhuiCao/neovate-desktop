/// <reference types="vite/client" />

interface NeodebugApi {
  onReactGrabAnnotationCreated?: (cb: (p: unknown) => void) => () => void;
}

declare global {
  interface Window {
    neodebugApi?: NeodebugApi;
  }
}

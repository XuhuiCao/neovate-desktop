// A provider whose connection is resolved lazily at session time (see the
// generic `providerResolver` contribution) can fail because the user hasn't set
// it up — e.g. codefuse-cli not installed or not logged in. The resolver throws
// this so the agent router can forward structured `setup` data to the renderer
// (as ORPCError.data.providerSetup), which then shows an actionable guide toast.
//
// Pure types + a plain Error subclass — no Node/Electron imports. The renderer
// reads `setup` structurally (duck-typed) and does NOT import this class.

export type ProviderSetupData = {
  providerId: string;
  kind: "auth" | "missing";
  docURL?: string;
};

export class ProviderSetupError extends Error {
  readonly setup: ProviderSetupData;
  constructor(message: string, setup: ProviderSetupData) {
    super(message);
    this.name = "ProviderSetupError";
    this.setup = setup;
  }
}

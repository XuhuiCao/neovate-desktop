import { oc, type, eventIterator } from "@orpc/contract";
import { z } from "zod";

export interface DeeplinkEvent {
  name: string;
  path: string;
  searchParams: Record<string, string>;
  data?: unknown;
  /** true when no main-process handler was registered for this name */
  unhandled: boolean;
}

/** session:new deeplink resolved data */
export interface SessionNewDeeplinkData {
  action: "new";
  /** Absolute project path (mutually exclusive with gitUrl; both empty → Playground fallback) */
  project?: string;
  /** Git repository URL (mutually exclusive with project) */
  gitUrl?: string;
  /** Prefilled message text */
  message?: string;
  /** Comma-separated file paths to inject as @file mentions */
  mentions?: string;
  /** Auto-send message after filling (default true) */
  autoStart?: boolean;
}

/** session:{sessionId} deeplink resolved data */
export interface SessionResumeDeeplinkData {
  action: "resume";
  sessionId: string;
  /** Absolute project path (omit to recover from session metadata) */
  project?: string;
}

export type SessionDeeplinkData = SessionNewDeeplinkData | SessionResumeDeeplinkData;

export const deeplinkContract = {
  subscribe: oc.output(eventIterator(type<DeeplinkEvent>())),
  /** Forward a deeplink URL from renderer (e.g. browser/iframe) to the DeeplinkService */
  handle: oc.input(z.object({ url: z.string() })).output(type<void>()),
};

import type React from "react";

import debug from "debug";

import type { ProviderTemplate } from "../../../../shared/features/provider/built-in";
import type { LocalizedString } from "../../../../shared/i18n";
import type { ExternalUriOpenerContribution } from "../external-uri-opener";
import type { IRendererApp } from "../types";
import type { Contribution } from "./contribution";

const log = debug("neovate:plugin");

// ─── Contribution Types ─────────────────────────────────────────────

/** View/UI contributions — things that register visual slots */
export interface PluginViewContributions {
  contentPanelViews?: ContentPanelView[];
  primaryTitlebarItems?: TitlebarItem[];
  secondaryTitlebarItems?: TitlebarItem[];
}

/** Data/config contributions — non-visual registrations */
export interface PluginContributions {
  providerTemplates?: ProviderTemplate[];
  externalUriOpeners?: ExternalUriOpenerContribution[];
}

/** Context passed to {@link ContentPanelView.isAvailable}. */
export interface ViewAvailabilityContext {
  cwd: string | null;
}

/** Context passed to {@link ContentPanelView.onClick} for action views. */
export interface ContentPanelViewClickContext {
  app: IRendererApp;
}

export interface ContentPanelView {
  viewType: string;
  name: string | LocalizedString;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** Optional inline icon color (overrides theme). */
  iconColor?: string;
  /** Display order in the new-tab menu. Lower values appear first. */
  order?: number;
  /**
   * Project types this view supports. When defined, the view is only shown
   * when the current project type matches one of the listed values.
   * Undefined means the view is always visible regardless of project type.
   */
  supportedProjectTypes?: string[];
  singleton?: boolean; // default true; per-project scope
  persist?: boolean; // default true; whether the tab is persisted to storage
  deactivation?: "hidden" | "offscreen" | "activity" | "unmount"; // default "hidden"
  /**
   * Keep this view's component mounted (off-screen) after its tab closes, so
   * reopening restores state (scroll position, form input, etc).
   * @default false
   */
  keepAliveOnClose?: boolean;
  /**
   * Only effective when `keepAliveOnClose` is true. When the timeout expires
   * and the tab is still closed, the component is finally unmounted.
   */
  keepAliveTimeout?: number;
  /** Whether the view supports a reload action (right-click → Reload). */
  reloadable?: boolean;
  /**
   * Whether this view is user-discoverable via the new-tab menu.
   *
   * Set to `false` or a function returning `false` for views that are opened
   * programmatically (e.g. by a plugin action) and should not be surfaced to
   * the user as a manual option.
   *
   * @default true
   */
  discoverable?: boolean | (() => boolean);
  /**
   * Dynamic, async availability check for the current scope (project/env).
   * Undefined means always available. Only gates entry-point display
   * (new-tab menu / empty state) — it does NOT affect openView().
   */
  isAvailable?: (ctx: ViewAvailabilityContext) => boolean | Promise<boolean>;
  /**
   * Custom click behavior for view entry points (new-tab menu / empty state).
   * When set, the view is treated as an action entry: clicking runs this
   * handler instead of opening a content-panel tab.
   */
  onClick?: (ctx: ContentPanelViewClickContext) => void | Promise<void>;
  component: () => Promise<{ default: React.ComponentType }>; // no props — uses hooks
}

/**
 * Returns true when the view provides a renderable component (not an
 * action-only view). Used to gate lazy mounting in the content panel.
 */
export function isRenderableContentPanelView(view: ContentPanelView): boolean {
  return typeof view.component === "function";
}

export interface TitlebarItem {
  id: string;
  tooltip?: string | LocalizedString;
  order?: number;
  component: () => Promise<{ default: React.ComponentType }>;
}

export interface WindowContribution {
  /** Unique window type identifier — matches windowType URL param */
  windowType: string;
  /** Root component rendered for this window type */
  component: () => Promise<{ default: React.ComponentType }>;
}

// ─── Utilities ──────────────────────────────────────────────────────

export const sortByOrder = <T extends { order?: number }>(list: Contribution<T>[]) =>
  list.toSorted((a, b) => (a.value.order ?? Infinity) - (b.value.order ?? Infinity));

export function deduplicateById<T extends { id: string }>(
  items: Contribution<T>[],
): Contribution<T>[] {
  const seen = new Set<string>();
  return items.filter((c) => {
    if (seen.has(c.value.id)) {
      log("duplicate id=%s from plugin=%s, skipping", c.value.id, c.plugin.name);
      return false;
    }
    seen.add(c.value.id);
    return true;
  });
}

export type ContentPanelRenderableView = {
  viewType: string;
  label: string;
  name?: string;
  icon?: string;
  singleton?: boolean;
  isAvailable?: (context: any) => boolean;
  discoverable?: boolean;
  supportedProjectTypes?: string[];
  component?: React.ComponentType<any>;
};

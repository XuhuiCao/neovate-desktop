const NEO_TITLE_PARAM = "__neoTitle__";

export interface GenericIframeUrlTarget extends Record<string, unknown> {
  url: string;
  title: string;
}

export interface GenericIframeUrlOpener {
  workbench: {
    contentPanel: {
      openView: (
        viewType: "generic-iframe",
        options: { state: GenericIframeUrlTarget; title: string },
      ) => string | null;
    };
  };
}

export function parseGenericIframeUrl(href: string): GenericIframeUrlTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (!parsed.searchParams.has(NEO_TITLE_PARAM)) {
    return null;
  }

  const rawTitle = parsed.searchParams.get(NEO_TITLE_PARAM) ?? "";
  parsed.searchParams.delete(NEO_TITLE_PARAM);

  const title = rawTitle.trim() || parsed.hostname;
  return { url: parsed.toString(), title };
}

export function openGenericIframeUrl(app: GenericIframeUrlOpener, href: string): boolean {
  const target = parseGenericIframeUrl(href);
  if (!target) return false;

  const tabId = app.workbench.contentPanel.openView("generic-iframe", {
    state: { url: target.url, title: target.title },
    title: target.title,
  });
  return !!tabId;
}

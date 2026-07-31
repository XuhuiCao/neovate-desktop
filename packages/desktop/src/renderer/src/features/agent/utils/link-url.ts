const EXPLICIT_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const DEFAULT_PROTOCOL_RE = /^https?:\/\//i;
const WWW_RE = /^www\./i;

const COMMON_WEB_TLDS = new Set([
  "ai",
  "app",
  "au",
  "biz",
  "ca",
  "cc",
  "cloud",
  "cn",
  "co",
  "com",
  "de",
  "dev",
  "edu",
  "fr",
  "gov",
  "hk",
  "id",
  "in",
  "info",
  "io",
  "jp",
  "kr",
  "me",
  "mil",
  "net",
  "online",
  "org",
  "ru",
  "sg",
  "sh",
  "site",
  "tech",
  "top",
  "tv",
  "uk",
  "us",
  "xyz",
]);

function stripDefaultProtocol(url: string): string {
  return url.replace(DEFAULT_PROTOCOL_RE, "");
}

function getHost(url: string): string {
  const beforePath = url.split(/[/?#]/, 1)[0] ?? "";
  return beforePath.replace(/:\d+$/, "");
}

function hasPathOrQuery(url: string): boolean {
  return /[/?#]/.test(url);
}

function hasCommonWebTld(host: string): boolean {
  const tld = host.split(".").pop()?.toLowerCase();
  return !!tld && COMMON_WEB_TLDS.has(tld);
}

export function shouldAutoLinkChatUrl(url: string): boolean {
  if (EXPLICIT_PROTOCOL_RE.test(url)) return true;

  const normalizedUrl = stripDefaultProtocol(url);
  const host = getHost(normalizedUrl);
  if (!host.includes(".") || !hasCommonWebTld(host)) return false;

  if (WWW_RE.test(normalizedUrl)) return true;
  if (hasPathOrQuery(normalizedUrl)) return true;

  return host.split(".").filter(Boolean).length >= 3;
}

export function shouldUseLinkHrefInPrompt(text: string, href: string): boolean {
  if (text === href) return true;
  if (EXPLICIT_PROTOCOL_RE.test(text)) return true;

  const hrefWithoutDefaultProtocol = stripDefaultProtocol(href);
  if (hrefWithoutDefaultProtocol === text) return shouldAutoLinkChatUrl(text);

  return true;
}

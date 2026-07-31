// @vitest-environment jsdom
import type { TFunction } from "i18next";

import { toastManager } from "@neo/ui/components/toast";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CFUSE_PROXY_ID, CFUSE_SETUP_DOC_URL } from "../session-init-error"; // cfuse-proxy stubbed
import { handleSessionInitError } from "../session-init-error";

// Avoid pulling React/base-ui into the test — we only assert how the helper calls
// toastManager.add, not how the toast renders.
vi.mock("@neo/ui/components/toast", () => ({ toastManager: { add: vi.fn() } }));

const addMock = vi.mocked(toastManager.add);

// Identity stub: returns the key, so assertions can check WHICH key was picked
// (locale parity / wording is covered by the locale-parity check, not here).
const t = ((key: string) => key) as unknown as TFunction;

// Shape mirrors the deserialized ORPCError the renderer receives: data.providerSetup.
function setupError(
  providerSetup: { providerId: string; kind: "auth" | "missing"; docURL?: string },
  message = "boom",
): Error {
  return Object.assign(new Error(message), { data: { providerSetup } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "open").mockReturnValue(null);
});

describe("handleSessionInitError — cfuse setup errors", () => {
  it("missing → install label + PATH-hedged message, opens setup doc", () => {
    const result = handleSessionInitError(
      setupError({ providerId: CFUSE_PROXY_ID, kind: "missing", docURL: CFUSE_SETUP_DOC_URL }),
      t,
    );

    expect(result.handled).toBe(true);
    // Returned message == toast description == inline-error source (one variable).
    expect(result.message).toBe("chat.providerSetup.cfuse.missingMessage");

    const arg = addMock.mock.calls[0]![0];
    expect(arg.description).toBe("chat.providerSetup.cfuse.missingMessage");
    expect(arg.actionProps?.children).toBe("chat.providerSetup.cfuse.installAction");

    arg.actionProps?.onClick?.({} as never);
    expect(window.open).toHaveBeenCalledWith(CFUSE_SETUP_DOC_URL, "_blank", "noopener");
  });

  it("auth → configure label + login message", () => {
    const result = handleSessionInitError(
      setupError({ providerId: CFUSE_PROXY_ID, kind: "auth", docURL: CFUSE_SETUP_DOC_URL }),
      t,
    );

    expect(result.handled).toBe(true);
    expect(result.message).toBe("chat.providerSetup.cfuse.authMessage");

    const arg = addMock.mock.calls[0]![0];
    expect(arg.description).toBe("chat.providerSetup.cfuse.authMessage");
    expect(arg.actionProps?.children).toBe("chat.providerSetup.cfuse.configureAction");
  });

  it("falls back to the shared doc URL when the wire omits docURL", () => {
    handleSessionInitError(setupError({ providerId: CFUSE_PROXY_ID, kind: "auth" }), t);
    const arg = addMock.mock.calls[0]![0];
    arg.actionProps?.onClick?.({} as never);
    expect(window.open).toHaveBeenCalledWith(CFUSE_SETUP_DOC_URL, "_blank", "noopener");
  });
});

describe("handleSessionInitError — non-cfuse fallthrough", () => {
  it("keeps the generic guide button and raw message", () => {
    const result = handleSessionInitError(
      setupError(
        { providerId: "some-other", kind: "auth", docURL: "https://example.test/doc" },
        "raw detail",
      ),
      t,
    );

    expect(result.handled).toBe(true);
    expect(result.message).toBe("raw detail");

    const arg = addMock.mock.calls[0]![0];
    expect(arg.description).toBe("raw detail");
    expect(arg.actionProps?.children).toBe("chat.providerSetup.openGuide");
  });

  it("returns handled=false for a non-setup error (no toast)", () => {
    const result = handleSessionInitError(new Error("plain failure"), t);
    expect(result).toEqual({ message: "plain failure", handled: false });
    expect(addMock).not.toHaveBeenCalled();
  });
});

describe("handleSessionInitError — transient spawn errors", () => {
  it("maps `spawn EBADF` to the friendly try-again fragment (no toast)", () => {
    const result = handleSessionInitError(new Error("spawn EBADF"), t);
    // Fragment key only — the inline renderer wraps it in
    // chat.sessionInitFailedDetail, so a full sentence would double the prefix.
    expect(result).toEqual({ message: "chat.sessionInitTransient", handled: false });
    expect(addMock).not.toHaveBeenCalled();
  });

  it("maps a simple-git-wrapped `Error: spawn EAGAIN` message too", () => {
    const result = handleSessionInitError(new Error("Error: spawn EAGAIN"), t);
    expect(result).toEqual({ message: "chat.sessionInitTransient", handled: false });
  });

  it("does NOT map a permanent `spawn ... ENOENT` error", () => {
    const result = handleSessionInitError(new Error("spawn claude ENOENT"), t);
    expect(result).toEqual({ message: "spawn claude ENOENT", handled: false });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const { navigateToSession } = vi.hoisted(() => ({ navigateToSession: vi.fn() }));
vi.mock("../../agent/navigation", () => ({ navigateToSession }));
// orpc-base 在 module-load 时建 MessageChannel + RPCLink,测试环境不可用;路由函数不触达 orpcClient。
vi.mock("../../../orpc", () => ({ orpcClient: {} }));

import { handleClick, handleNotificationEvent } from "../notification-sink";

describe("notification-sink routing", () => {
  beforeEach(() => navigateToSession.mockClear());

  it("chat payload navigates directly to the session", () => {
    handleClick({ type: "chat", sessionId: "s1" });
    expect(navigateToSession).toHaveBeenCalledWith("s1");
  });

  it("native-clicked event routes to handleClick", () => {
    handleNotificationEvent({ type: "native-clicked", payload: { type: "chat", sessionId: "s2" } });
    expect(navigateToSession).toHaveBeenCalledWith("s2");
  });

  it("unknown payload type is a no-op", () => {
    handleClick({ type: "unknown" } as any);
    expect(navigateToSession).not.toHaveBeenCalled();
  });
});

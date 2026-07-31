import { describe, expect, it } from "vitest";

import { getSkillInitials } from "../skill-initials";

describe("getSkillInitials", () => {
  it("uses the first letters of the first two name segments", () => {
    expect(getSkillInitials("risk automation")).toBe("RA");
  });

  it("ignores leading separators", () => {
    expect(getSkillInitials("-21risk-automation")).toBe("2A");
  });

  it("ignores repeated separators", () => {
    expect(getSkillInitials("__agent__tools")).toBe("AT");
  });

  it("falls back to the first two characters for one segment", () => {
    expect(getSkillInitials("neo")).toBe("NE");
  });

  it("uses a placeholder for empty names", () => {
    expect(getSkillInitials(" -- ")).toBe("?");
  });
});

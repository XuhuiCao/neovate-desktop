// packages/desktop/src/main/features/chat/attachments/__tests__/filename.test.ts
import { describe, expect, it } from "vitest";

import { normalizeAttachmentName } from "../filename";

describe("normalizeAttachmentName", () => {
  it("preserves spaces, @, unicode verbatim", () => {
    expect(normalizeAttachmentName("CleanShot 2026 at 16.04@2x.png", "image/png")).toBe(
      "CleanShot 2026 at 16.04@2x.png",
    );
  });

  it("strips path separators and traversal", () => {
    expect(normalizeAttachmentName("../../etc/passwd.png", "image/png")).toBe("etcpasswd.png");
    expect(normalizeAttachmentName("a/b\\c.png", "image/png")).toBe("abc.png");
  });

  it("falls back to pasted-image.<ext> when empty / missing", () => {
    expect(normalizeAttachmentName(undefined, "image/png")).toBe("pasted-image.png");
    expect(normalizeAttachmentName("", "image/jpeg")).toBe("pasted-image.jpg");
    expect(normalizeAttachmentName("..", "image/webp")).toBe("pasted-image.webp");
  });

  it("derives extension from mediaType when name has none", () => {
    expect(normalizeAttachmentName("screenshot", "image/png")).toBe("screenshot.png");
  });

  it("keeps existing extension as-is", () => {
    expect(normalizeAttachmentName("photo.JPG", "image/png")).toBe("photo.JPG");
  });

  it("truncates to 255 bytes preserving extension", () => {
    const long = "x".repeat(300) + ".png";
    const out = normalizeAttachmentName(long, "image/png");
    expect(Buffer.byteLength(out, "utf8")).toBeLessThanOrEqual(255);
    expect(out.endsWith(".png")).toBe(true);
  });

  it("terminates and stays within 255 bytes when the extension itself is huge", () => {
    // A 300-char tail after a dot is not a real extension; treating it as one
    // would make the byte budget negative and loop forever (regression guard).
    const out = normalizeAttachmentName("a." + "x".repeat(300), "image/png");
    expect(Buffer.byteLength(out, "utf8")).toBeLessThanOrEqual(255);
  });
});

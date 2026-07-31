import { describe, expect, it } from "vitest";

import type { ReactGrabCommentPayload } from "../../../../../shared/claude-code/types";

import {
  appendReactGrabCommentsToText,
  removeReactGrabComment,
  formatReactGrabCommentsForModel,
  stripReactGrabCommentsFromText,
  updateReactGrabCommentText,
  upsertReactGrabComment,
} from "../utils/react-grab-comments";

const payload: ReactGrabCommentPayload = {
  payloadId: "react-grab-test",
  summary: "已添加 2 条标注",
  count: 2,
  comments: [
    {
      id: "comment-1",
      commentText: "标题不应该换行",
      content: '<h1 class="title">标题</h1>',
      screenshotPath: "/tmp/react-grab/comment-1.png",
    },
    {
      id: "comment-2",
      commentText: "按钮颜色需要更醒目",
    },
  ],
};

describe("react grab comment text marker", () => {
  it("formats comments as text-only model context", () => {
    expect(formatReactGrabCommentsForModel(payload)).toMatchInlineSnapshot(`
      "<user-page-annotations>
      用户在页面中添加了 2 条标注：
      1. 标题不应该换行
         关联元素：<h1 class="title">标题</h1>
      2. 按钮颜色需要更醒目
      </user-page-annotations>"
    `);
  });

  it("appends model context and strips it from visible user text", () => {
    const outgoing = appendReactGrabCommentsToText("帮我看一下页面", payload);

    expect(outgoing).toContain("<user-page-annotations>");
    expect(outgoing).toContain("1. 标题不应该换行");
    expect(stripReactGrabCommentsFromText(outgoing)).toBe("帮我看一下页面");
  });

  it("strips legacy React Grab markers from visible user text", () => {
    const legacy = [
      "帮我看一下页面",
      "",
      "<neodebug-react-grab-comments>",
      "React Grab comments (1):",
      "1. 老消息",
      "</neodebug-react-grab-comments>",
    ].join("\n");

    expect(stripReactGrabCommentsFromText(legacy)).toBe("帮我看一下页面");
  });

  it("does not alter text without comments", () => {
    expect(appendReactGrabCommentsToText("hello", null)).toBe("hello");
    expect(stripReactGrabCommentsFromText("hello")).toBe("hello");
  });

  it("upserts, removes, and edits pending annotations", () => {
    const appended = upsertReactGrabComment(null, payload.comments[0]);
    expect(appended.summary).toBe("已添加 1 条标注");
    expect(appended.comments).toHaveLength(1);

    const replaced = upsertReactGrabComment(appended, {
      ...payload.comments[0],
      commentText: "标题需要压缩",
    });
    expect(replaced.comments).toHaveLength(1);
    expect(replaced.comments[0].commentText).toBe("标题需要压缩");

    const edited = updateReactGrabCommentText(replaced, "comment-1", "标题需要居中");
    expect(edited?.summary).toBe("已添加 1 条标注");
    expect(edited?.comments[0].commentText).toBe("标题需要居中");

    expect(removeReactGrabComment(edited, "comment-1")).toBeNull();
  });
});

import type { ReactGrabCommentPayload } from "../../../../../shared/claude-code/types";

export const REACT_GRAB_COMMENTS_START = "<neodebug-react-grab-comments>";
export const REACT_GRAB_COMMENTS_END = "</neodebug-react-grab-comments>";
const USER_PAGE_ANNOTATIONS_START = "<user-page-annotations>";
const USER_PAGE_ANNOTATIONS_END = "</user-page-annotations>";

type ReactGrabComment = ReactGrabCommentPayload["comments"][number];

function stripBetween(text: string, startMarker: string, endMarker: string): string | null {
  const startIndex = text.indexOf(startMarker);
  if (startIndex < 0) return null;
  const endIndex = text.indexOf(endMarker, startIndex);
  if (endIndex < 0) return text.slice(0, startIndex).trimEnd();
  return `${text.slice(0, startIndex)}${text.slice(endIndex + endMarker.length)}`.trimEnd();
}

export function formatReactGrabCommentsForModel(payload: ReactGrabCommentPayload | null): string {
  if (!payload || payload.comments.length === 0) return "";
  const lines = payload.comments.flatMap((comment, index) => {
    const text = comment.commentText.trim() || "（空标注）";
    const content = comment.content?.trim();
    return content
      ? [`${index + 1}. ${text}`, `   关联元素：${content}`]
      : [`${index + 1}. ${text}`];
  });
  return [
    USER_PAGE_ANNOTATIONS_START,
    `用户在页面中添加了 ${payload.comments.length} 条标注：`,
    ...lines,
    USER_PAGE_ANNOTATIONS_END,
  ].join("\n");
}

export function appendReactGrabCommentsToText(
  text: string,
  payload: ReactGrabCommentPayload | null,
): string {
  const formatted = formatReactGrabCommentsForModel(payload);
  return formatted ? `${text.trimEnd()}\n\n${formatted}` : text;
}

export function stripReactGrabCommentsFromText(text: string): string {
  return (
    stripBetween(text, USER_PAGE_ANNOTATIONS_START, USER_PAGE_ANNOTATIONS_END) ??
    stripBetween(text, REACT_GRAB_COMMENTS_START, REACT_GRAB_COMMENTS_END) ??
    text
  );
}

export function createReactGrabCommentPayload(
  comments: ReactGrabComment[],
  payloadId?: string,
): ReactGrabCommentPayload | null {
  if (comments.length === 0) return null;
  return {
    payloadId:
      payloadId ??
      `page-annotations-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    summary: `已添加 ${comments.length} 条标注`,
    count: comments.length,
    comments,
  };
}

export function upsertReactGrabComment(
  payload: ReactGrabCommentPayload | null,
  comment: ReactGrabComment,
): ReactGrabCommentPayload {
  const comments = payload?.comments ?? [];
  const index = comments.findIndex((item) => item.id === comment.id);
  const nextComments =
    index >= 0
      ? comments.map((item) => (item.id === comment.id ? comment : item))
      : [...comments, comment];
  return createReactGrabCommentPayload(nextComments, payload?.payloadId)!;
}

export function removeReactGrabComment(
  payload: ReactGrabCommentPayload | null,
  commentId: string,
): ReactGrabCommentPayload | null {
  if (!payload) return null;
  return createReactGrabCommentPayload(
    payload.comments.filter((comment) => comment.id !== commentId),
    payload.payloadId,
  );
}

export function updateReactGrabCommentText(
  payload: ReactGrabCommentPayload | null,
  commentId: string,
  commentText: string,
): ReactGrabCommentPayload | null {
  if (!payload) return null;
  return createReactGrabCommentPayload(
    payload.comments.map((comment) =>
      comment.id === commentId ? { ...comment, commentText } : comment,
    ),
    payload.payloadId,
  );
}

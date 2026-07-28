import { isToolUIPart } from "ai";

import type {
  ClaudeCodeUIMessage,
  ClaudeCodeUIMessagePart,
} from "../../../../../shared/claude-code/types";

/**
 * The `tool-TodoWrite` member of the message part union.
 *
 * Note: the open-source Claude Code SDK ships only `TodoWrite` for task
 * tracking — there is no `tool-TaskCreate` / `tool-TaskUpdate` in the
 * `ClaudeCodeUITools` registry. Progress is therefore derived solely from
 * the latest `TodoWrite` snapshot. If a future SDK reintroduces split Task
 * tools, port the `deriveProgressFromTasks` accumulator from the internal
 * source (no union changes are needed beyond registering the tools).
 */
type TodoWriteToolPart = Extract<ClaudeCodeUIMessagePart, { type: "tool-TodoWrite" }>;

/** Fully-formed TodoWrite input (from the `input-available` / `output-available` states). */
type TodoWriteInput = NonNullable<
  Extract<TodoWriteToolPart, { state: "output-available" }>["input"]
>;

export type SummaryTodoStatus = "pending" | "in_progress" | "completed";

export type SummaryTodo = {
  content: string;
  label: string;
  status: SummaryTodoStatus;
};

export type SummaryProgress = {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  todos: SummaryTodo[];
};

function summarize(todos: SummaryTodo[]): SummaryProgress {
  return {
    total: todos.length,
    completed: todos.filter((todo) => todo.status === "completed").length,
    inProgress: todos.filter((todo) => todo.status === "in_progress").length,
    pending: todos.filter((todo) => todo.status === "pending").length,
    todos,
  };
}

function isUsableState(state: string | undefined): boolean {
  return state === "input-available" || state === "output-available";
}

function isTodoWriteToolPart(part: ClaudeCodeUIMessagePart): part is TodoWriteToolPart {
  return isToolUIPart(part) && part.type === "tool-TodoWrite";
}

function toTodo(raw: TodoWriteInput["todos"][number]): SummaryTodo | null {
  if (typeof raw.content !== "string") return null;
  if (raw.status !== "pending" && raw.status !== "in_progress" && raw.status !== "completed") {
    return null;
  }
  const activeForm = typeof raw.activeForm === "string" ? raw.activeForm : raw.content;
  return {
    content: raw.content,
    label: raw.status === "in_progress" ? activeForm : raw.content,
    status: raw.status,
  };
}

export function deriveProgressFromTodoWrite(
  messages: ClaudeCodeUIMessage[],
): SummaryProgress | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    for (let j = message.parts.length - 1; j >= 0; j -= 1) {
      const part = message.parts[j];
      if (!isTodoWriteToolPart(part)) continue;
      if (!isUsableState(part.state)) continue;
      // `isUsableState` guarantees an available state, where `input` is fully formed.
      const input = part.input as TodoWriteInput | undefined;
      const todos = input?.todos?.map(toTodo).filter((todo): todo is SummaryTodo => !!todo);
      if (!todos || todos.length === 0) continue;
      return summarize(todos);
    }
  }
  return null;
}

/**
 * Derive the progress summary from the agent's most recent `TodoWrite`
 * snapshot. Scans messages newest-first, returning the first usable
 * todo list it finds.
 */
export function deriveProgress(messages: ClaudeCodeUIMessage[]): SummaryProgress | null {
  return deriveProgressFromTodoWrite(messages);
}

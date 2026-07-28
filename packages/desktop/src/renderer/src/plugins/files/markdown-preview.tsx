import { Streamdown } from "streamdown";

import { cn } from "../../lib/utils";

/**
 * 文件预览专用 Markdown 渲染（规范 §6.3）。
 * 比 chat 内联 markdown 更大的标题/表格样式；表格容器带边框、表头吸顶。
 */
export function MarkdownPreview({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("markdown-root size-full overflow-auto p-6 text-sm", className)}>
      <Streamdown
        components={{
          h1: ({ children, ...props }) => (
            <h1 className="mb-4 mt-6 text-[2em] font-bold first:mt-0" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="mb-3 mt-5 text-[1.5em] font-semibold first:mt-0" {...props}>
              {children}
            </h2>
          ),
          table: ({ children, ...props }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="sticky top-0 z-10 bg-card" {...props}>
              {children}
            </thead>
          ),
        }}
      >
        {content}
      </Streamdown>
    </div>
  );
}

import { File as PierreFile } from "@pierre/diffs/react";
import { FilePlusIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo } from "react";

import type { WriteUIToolInvocation } from "../../../../../../shared/claude-code/types";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";
import { FileTag } from "./file-tag";

export function WriteTool({ invocation }: { invocation: WriteUIToolInvocation }) {
  if (!invocation || invocation.state === "input-streaming") return null;
  const { input } = invocation;
  const { resolvedTheme } = useTheme();

  const filePath = input?.file_path;
  const fileName = filePath?.split("/").pop() ?? "file";
  const content = input?.content || "";
  const lineCount = useMemo(() => (content ? content.split("\n").length : 0), [content]);

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={FilePlusIcon} />
        <ToolHeaderTitle>Write {lineCount} lines</ToolHeaderTitle>
        {filePath && <FileTag filePath={filePath} />}
      </ToolHeader>
      <ToolContent className="bg-transparent p-0">
        {content ? (
          <PierreFile
            file={{ name: fileName, contents: content }}
            options={{
              theme: resolvedTheme === "dark" ? "pierre-dark" : "pierre-light",
              disableFileHeader: true,
            }}
          />
        ) : null}
      </ToolContent>
    </Tool>
  );
}

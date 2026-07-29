import { MultiFileDiff } from "@pierre/diffs/react";
import { FileEdit } from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo } from "react";

import type { EditUIToolInvocation } from "../../../../../../shared/claude-code/types";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";
import { FileTag } from "./file-tag";

export function EditTool({ invocation }: { invocation: EditUIToolInvocation }) {
  const input = invocation?.state !== "input-streaming" ? invocation?.input : undefined;
  const output = invocation?.state === "output-available" ? invocation.output : undefined;
  const { resolvedTheme } = useTheme();

  const filePath = output?.filePath ?? input?.file_path;
  const fileName = filePath?.split("/").pop();

  const diffStats = useMemo(() => {
    if (output?.structuredPatch) {
      let additions = 0;
      let deletions = 0;
      for (const hunk of output.structuredPatch) {
        for (const line of hunk.lines) {
          if (line.startsWith("+")) additions++;
          else if (line.startsWith("-")) deletions++;
        }
      }
      return { additions, deletions };
    }
    return null;
  }, [output?.structuredPatch]);

  const oldString = output?.oldString ?? input?.old_string ?? "";
  const newString = output?.newString ?? input?.new_string ?? "";

  const oldFile = useMemo(
    () => ({ name: fileName || "old", contents: oldString }),
    [fileName, oldString],
  );
  const newFile = useMemo(
    () => ({ name: fileName || "new", contents: newString }),
    [fileName, newString],
  );

  if (!invocation || invocation.state === "input-streaming") return null;

  return (
    <Tool invocation={invocation}>
      <ToolHeader>
        <ToolHeaderIcon icon={FileEdit} />
        <ToolHeaderTitle>Edit</ToolHeaderTitle>
        {filePath && <FileTag filePath={filePath} />}
        {diffStats && (
          <span className="shrink-0 text-xs text-muted-foreground">
            <span className="text-green-600 dark:text-green-500">+{diffStats.additions}</span>{" "}
            <span className="text-red-600 dark:text-red-500">-{diffStats.deletions}</span>
          </span>
        )}
      </ToolHeader>
      <ToolContent className="bg-transparent p-0">
        <MultiFileDiff
          oldFile={oldFile}
          newFile={newFile}
          options={{
            theme: resolvedTheme === "dark" ? "pierre-dark" : "pierre-light",
            diffStyle: "unified",
            disableFileHeader: true,
            disableLineNumbers: true,
          }}
        />
      </ToolContent>
    </Tool>
  );
}

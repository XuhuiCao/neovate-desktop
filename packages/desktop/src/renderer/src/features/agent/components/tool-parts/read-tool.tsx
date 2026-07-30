import { FileTextIcon, ImageIcon } from "lucide-react";
import { useMemo } from "react";

import type { ReadUIToolInvocation } from "../../../../../../shared/claude-code/types";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolHeaderIcon,
  ToolHeaderTitle,
} from "../../../../components/ai-elements/tool";
import { ImageOverlay } from "../image-overlay";
import { FileTag } from "./file-tag";

export function ReadTool({ invocation }: { invocation: ReadUIToolInvocation }) {
  if (!invocation || invocation.state === "input-streaming") return null;

  const { input, output } = invocation;
  const filePath = input?.file_path;
  const isImage = output?.type === "image";

  const imageSrc = useMemo(
    () =>
      isImage && output.file ? `data:${output.file.type};base64,${output.file.base64}` : undefined,
    [isImage, output],
  );

  return (
    <Tool invocation={invocation} collapsible={isImage} defaultOpen={isImage}>
      <ToolHeader>
        <ToolHeaderIcon icon={isImage ? ImageIcon : FileTextIcon} />
        <ToolHeaderTitle>
          Read{" "}
          {output?.type === "text" ? `${output.file.totalLines} lines` : isImage ? "image" : null}
        </ToolHeaderTitle>
        {filePath && <FileTag filePath={filePath} />}
      </ToolHeader>
      {isImage && imageSrc && (
        <ToolContent className="bg-transparent p-0">
          <ImageOverlay src={imageSrc} alt={filePath}>
            <img
              src={imageSrc}
              alt={filePath ?? ""}
              className="max-h-80 max-w-full rounded-lg object-contain ring-1 ring-border/50 cursor-zoom-in transition-opacity hover:opacity-90"
            />
          </ImageOverlay>
        </ToolContent>
      )}
    </Tool>
  );
}

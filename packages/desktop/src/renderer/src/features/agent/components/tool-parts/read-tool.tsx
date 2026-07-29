import { File } from "@pierre/diffs/react";
import { FileText, ImageIcon } from "lucide-react";

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
  const { input, output } = invocation;
  const filePath = input?.file_path;

  if (!invocation || invocation.state === "input-streaming") return null;

  const fileName = filePath?.split("/").pop();
  const isImage = output?.type === "image";

  const imageDataUrl = isImage
    ? `data:${output.file.type};base64,${output.file.base64}`
    : undefined;

  return (
    <Tool invocation={invocation} collapsible={isImage} defaultOpen={isImage}>
      <ToolHeader>
        <ToolHeaderIcon icon={isImage ? ImageIcon : FileText} />
        <ToolHeaderTitle>
          Read{" "}
          {output?.type === "text" ? `${output.file.totalLines} lines` : isImage ? "image" : null}
        </ToolHeaderTitle>
        {filePath && <FileTag filePath={filePath} />}
      </ToolHeader>
      <ToolContent>
        {output?.type === "text" ? (
          <File
            file={{ contents: output.file.content, name: fileName || "" }}
            options={{ disableFileHeader: true }}
          />
        ) : null}
        {isImage && imageDataUrl ? (
          <div className="flex flex-wrap gap-2">
            <ImageOverlay src={imageDataUrl} alt={fileName ?? "image"}>
              <img
                src={imageDataUrl}
                alt={fileName ?? "image"}
                className="h-20 w-20 cursor-zoom-in rounded-lg object-cover ring-1 ring-border/50 opacity-100 transition-opacity hover:opacity-80"
              />
            </ImageOverlay>
          </div>
        ) : null}
      </ToolContent>
    </Tool>
  );
}

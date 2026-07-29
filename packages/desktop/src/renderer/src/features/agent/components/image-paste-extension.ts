import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Extension } from "@tiptap/react";
import debug from "debug";

const log = debug("neovate:image-paste");

type ImagePasteOptions = {
  onFiles: (files: File[]) => void;
};

function extractImageFiles(dataTransfer: DataTransfer): File[] {
  const files: File[] = [];
  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i];
    if (file.type.startsWith("image/")) files.push(file);
  }
  // Some browsers put pasted images in items rather than files.
  if (files.length === 0 && dataTransfer.items) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }
  log("extractImageFiles: count=%d", files.length);
  return files;
}

export function createImagePasteExtension(onFiles: (files: File[]) => void) {
  return Extension.create<ImagePasteOptions>({
    name: "imagePaste",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("imagePaste"),
          props: {
            handlePaste(_view, event) {
              const files = event.clipboardData ? extractImageFiles(event.clipboardData) : [];
              if (files.length === 0) return false;
              event.preventDefault();
              onFiles(files);
              return true;
            },
            handleDrop(_view, event) {
              const dt = (event as DragEvent).dataTransfer;
              const files = dt ? extractImageFiles(dt) : [];
              if (files.length === 0) return false;
              event.preventDefault();
              onFiles(files);
              return true;
            },
          },
        }),
      ];
    },
  });
}

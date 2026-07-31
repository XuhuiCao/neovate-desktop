import type { Context, PropsWithChildren } from "react";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { FileStat } from "../../../../shared/features/fs/contract";

import { createFileStatBatcher } from "./file-stat-batcher";
import { statManyFiles } from "./file-stat-client";
import { createIntersectionObserverPool } from "./intersection-observer-pool";

export interface FilePathStatusRuntime {
  observe(element: Element, listener: (nearViewport: boolean) => void): () => void;
  load(absolutePath: string): Promise<FileStat | null>;
}

const FilePathStatusContext: Context<FilePathStatusRuntime | null> =
  import.meta.hot?.data?.FilePathStatusContext ?? createContext<FilePathStatusRuntime | null>(null);

if (import.meta.hot?.data) {
  import.meta.hot.data.FilePathStatusContext = FilePathStatusContext;
}

export function FilePathStatusProvider({ children }: PropsWithChildren) {
  const [observerPool] = useState(createIntersectionObserverPool);
  const [batcher] = useState(() => createFileStatBatcher(statManyFiles));

  useEffect(
    () => () => {
      observerPool.reset();
      batcher.reset();
    },
    [batcher, observerPool],
  );

  const value = useMemo<FilePathStatusRuntime>(
    () => ({
      observe: observerPool.observe,
      load: batcher.load,
    }),
    [batcher.load, observerPool.observe],
  );

  return <FilePathStatusContext.Provider value={value}>{children}</FilePathStatusContext.Provider>;
}

export function useFilePathStatusRuntime(): FilePathStatusRuntime {
  const runtime = useContext(FilePathStatusContext);
  if (!runtime) throw new Error("useFilePathStatus must be used within FilePathStatusProvider");
  return runtime;
}

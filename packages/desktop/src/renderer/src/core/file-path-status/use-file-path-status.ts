import type { RefCallback } from "react";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { orpcQueryUtils } from "../../orpc";
import { useFilePathStatusRuntime } from "./provider";

export interface FilePathStatus {
  ref: RefCallback<HTMLElement>;
  isFile: boolean;
}

export function useFilePathStatus(absolutePath: string | null): FilePathStatus {
  const runtime = useFilePathStatusRuntime();
  const [nearViewport, setNearViewport] = useState(false);
  const stopObservingRef = useRef<(() => void) | null>(null);

  const ref = useCallback<RefCallback<HTMLElement>>(
    (element) => {
      stopObservingRef.current?.();
      stopObservingRef.current = null;
      if (!element || absolutePath === null) return;

      setNearViewport(false);
      stopObservingRef.current = runtime.observe(element, setNearViewport);
    },
    [absolutePath, runtime.observe],
  );

  useEffect(
    () => () => {
      stopObservingRef.current?.();
      stopObservingRef.current = null;
    },
    [],
  );

  const query = useQuery({
    queryKey: orpcQueryUtils.fs.statMany.key({
      input: absolutePath === null ? [] : [absolutePath],
    }),
    queryFn: async () => {
      if (absolutePath === null) throw new Error("file path status query requires a path");
      return [await runtime.load(absolutePath)];
    },
    select: ([stat]) => stat ?? null,
    enabled: absolutePath !== null && nearViewport,
    staleTime: 30_000,
    retry: false,
  });

  return {
    ref,
    isFile: query.isSuccess && query.data?.isFile === true,
  };
}

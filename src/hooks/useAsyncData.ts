"use client";

import type { DependencyList } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type UseAsyncDataOptions<T> = {
  deps: DependencyList;
  initialData: T;
  load: () => Promise<T>;
  onError?: (error: unknown) => void;
};

export function useAsyncData<T>({ deps, initialData, load, onError }: UseAsyncDataOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const initialDataRef = useRef(initialData);
  const loadRef = useRef(load);
  const onErrorRef = useRef(onError);
  const previousDepsRef = useRef<DependencyList | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    initialDataRef.current = initialData;
  }, [initialData]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);

    try {
      const nextData = await loadRef.current();
      if (requestIdRef.current === requestId) setData(nextData);
      return nextData;
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setData(initialDataRef.current);
        onErrorRef.current?.(error);
      }
      return initialDataRef.current;
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const previousDeps = previousDepsRef.current;
    const shouldReload =
      previousDeps === null || previousDeps.length !== deps.length || previousDeps.some((dependency, index) => !Object.is(dependency, deps[index]));

    if (!shouldReload) return;

    previousDepsRef.current = deps;
    void reload();
  }, [reload, ...deps]);

  return { data, isLoading, reload, setData };
}


"use client";

import type { DependencyList } from "react";
import { useCallback, useEffect, useState } from "react";

type UseAsyncDataOptions<T> = {
  deps: DependencyList;
  initialData: T;
  load: () => Promise<T>;
  onError?: (error: unknown) => void;
};

export function useAsyncData<T>({ deps, initialData, load, onError }: UseAsyncDataOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextData = await load();
      setData(nextData);
      return nextData;
    } catch (error) {
      onError?.(error);
      return initialData;
    } finally {
      setIsLoading(false);
    }
  }, [initialData, load, onError]);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    load()
      .then((nextData) => {
        if (isMounted) setData(nextData);
      })
      .catch((error) => {
        if (isMounted) {
          setData(initialData);
          onError?.(error);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, deps);

  return { data, isLoading, reload, setData };
}

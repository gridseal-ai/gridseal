import { useState, useEffect, useCallback } from "react";

export type AsyncState<T> =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: string };

/**
 * Generic hook that runs an async function and tracks loading/error/data state.
 * Re-runs when deps change. Returns a reload callback.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    status: "idle",
    data: null,
    error: null,
  });

  const execute = useCallback(() => {
    setState({ status: "loading", data: null, error: null });
    fn()
      .then((data) => setState({ status: "success", data, error: null }))
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "An unknown error occurred";
        setState({ status: "error", data: null, error: message });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { ...state, reload: execute };
}

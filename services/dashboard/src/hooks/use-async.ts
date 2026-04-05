import { useState, useEffect, useRef } from "react";

export type AsyncState<T> =
  | { readonly status: "loading"; readonly data: null; readonly error: null }
  | { readonly status: "success"; readonly data: T; readonly error: null }
  | { readonly status: "error"; readonly data: null; readonly error: string };

/**
 * Calls an async function and tracks its loading/success/error state.
 * Re-runs when any value in deps changes.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    status: "loading",
    data: null,
    error: null,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setState({ status: "loading", data: null, error: null });

    fn()
      .then((data) => {
        if (mountedRef.current) {
          setState({ status: "success", data, error: null });
        }
      })
      .catch((err: unknown) => {
        if (mountedRef.current) {
          const message = err instanceof Error ? err.message : "Unknown error";
          setState({ status: "error", data: null, error: message });
        }
      });

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

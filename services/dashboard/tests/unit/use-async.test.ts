import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAsync } from "../../src/hooks/use-async.js";

describe("useAsync", () => {
  it("starts in loading state", () => {
    const fn = vi.fn(() => new Promise<string>(() => {}));
    const { result } = renderHook(() => useAsync(fn, []));
    expect(result.current.status).toBe("loading");
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("transitions to success on resolved promise", async () => {
    const fn = vi.fn(() => Promise.resolve("data"));
    const { result } = renderHook(() => useAsync(fn, []));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toBe("data");
    expect(result.current.error).toBeNull();
  });

  it("transitions to error on rejected promise", async () => {
    const fn = vi.fn(() => Promise.reject(new Error("fail")));
    const { result } = renderHook(() => useAsync(fn, []));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("fail");
    expect(result.current.data).toBeNull();
  });

  it("handles non-Error rejection", async () => {
    const fn = vi.fn(() => Promise.reject("string error"));
    const { result } = renderHook(() => useAsync(fn, []));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Unknown error");
  });

  it("re-runs when deps change", async () => {
    let counter = 0;
    const fn = vi.fn(() => Promise.resolve(++counter));
    const { result, rerender } = renderHook(
      ({ dep }: { dep: number }) => useAsync(fn, [dep]),
      { initialProps: { dep: 1 } },
    );
    await waitFor(() => expect(result.current.data).toBe(1));

    rerender({ dep: 2 });
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

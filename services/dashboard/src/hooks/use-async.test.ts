import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAsync } from "./use-async.js";

describe("useAsync", () => {
  it("starts in loading state and transitions to success", async () => {
    const fn = vi.fn().mockResolvedValue({ data: 42 });

    const { result } = renderHook(() => useAsync(fn, []));

    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual({ data: 42 });
    expect(result.current.error).toBeNull();
  });

  it("transitions to error state on rejection", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("network failure"));

    const { result } = renderHook(() => useAsync(fn, []));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("network failure");
    expect(result.current.data).toBeNull();
  });

  it("re-fetches when deps change", async () => {
    const fn = vi.fn().mockResolvedValue("first");

    const { result, rerender } = renderHook(
      ({ dep }: { dep: number }) => useAsync(() => fn(dep), [dep]),
      { initialProps: { dep: 1 } },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(fn).toHaveBeenCalledWith(1);

    fn.mockResolvedValue("second");
    rerender({ dep: 2 });

    await waitFor(() => expect(result.current.data).toBe("second"));
    expect(fn).toHaveBeenCalledWith(2);
  });

  it("provides a reload callback that re-runs the fetch", async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(callCount);
    });

    const { result } = renderHook(() => useAsync(fn, []));

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toBe(1);

    result.current.reload();

    await waitFor(() => expect(result.current.data).toBe(2));
  });

  it("handles non-Error rejections gracefully", async () => {
    const fn = vi.fn().mockRejectedValue("string error");

    const { result } = renderHook(() => useAsync(fn, []));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("An unknown error occurred");
  });
});

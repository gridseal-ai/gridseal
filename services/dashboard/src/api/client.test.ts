import { describe, it, expect, afterEach, vi } from "vitest";
import {
  fetchChains,
  fetchEntries,
  fetchEntry,
  fetchEntryChildren,
  fetchEntrySubtree,
  validateChain,
  fetchCertificate,
  fetchRegulations,
  fetchReport,
  ApiError,
} from "./client.js";

function mockFetchSuccess(data: unknown): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockFetchError(status: number, body: unknown): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: false,
    status,
    statusText: "Bad Request",
    json: () => Promise.resolve(body),
  } as Response);
}

describe("API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchChains", () => {
    it("returns chains from the API", async () => {
      const payload = { chains: [{ chainId: "c1", entryCount: 5 }] };
      mockFetchSuccess(payload);

      const result = await fetchChains();

      expect(result).toEqual(payload);
      expect(fetch).toHaveBeenCalledWith(
        "/api/chains",
        expect.objectContaining({
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
        }),
      );
    });
  });

  describe("fetchEntries", () => {
    it("builds URL with pagination and filters", async () => {
      const payload = { chainId: "c1", entries: [], total: 0, offset: 0, limit: 25 };
      mockFetchSuccess(payload);

      await fetchEntries("c1", 10, 25, { modelId: "gpt-4o", sessionId: "s1" });

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain("/api/chains/c1/entries?");
      expect(calledUrl).toContain("offset=10");
      expect(calledUrl).toContain("limit=25");
      expect(calledUrl).toContain("modelId=gpt-4o");
      expect(calledUrl).toContain("sessionId=s1");
    });

    it("omits undefined filter params", async () => {
      mockFetchSuccess({ chainId: "c1", entries: [], total: 0, offset: 0, limit: 25 });

      await fetchEntries("c1", 0, 25);

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(calledUrl).not.toContain("modelId");
      expect(calledUrl).not.toContain("actorId");
    });
  });

  describe("fetchEntry", () => {
    it("fetches a single entry by chain and entry ID", async () => {
      const entry = { entryId: "e1", chainId: "c1" };
      mockFetchSuccess({ entry });

      const result = await fetchEntry("c1", "e1");

      expect(result).toEqual({ entry });
      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(calledUrl).toBe("/api/chains/c1/entries/e1");
    });
  });

  describe("fetchEntryChildren", () => {
    it("fetches children of an entry", async () => {
      const payload = { parentEntryId: "e1", children: [] };
      mockFetchSuccess(payload);

      const result = await fetchEntryChildren("c1", "e1");

      expect(result).toEqual(payload);
      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(calledUrl).toBe("/api/chains/c1/entries/e1/children");
    });
  });

  describe("fetchEntrySubtree", () => {
    it("fetches subtree of an entry", async () => {
      const payload = { rootEntryId: "e1", entries: [] };
      mockFetchSuccess(payload);

      const result = await fetchEntrySubtree("c1", "e1");

      expect(result).toEqual(payload);
      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(calledUrl).toBe("/api/chains/c1/entries/e1/subtree");
    });
  });

  describe("validateChain", () => {
    it("sends POST to validate endpoint", async () => {
      const payload = { valid: true, chainId: "c1", entryCount: 10 };
      mockFetchSuccess(payload);

      const result = await validateChain("c1");

      expect(result).toEqual(payload);
      expect(fetch).toHaveBeenCalledWith(
        "/api/chains/c1/validate",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("fetchCertificate", () => {
    it("fetches a certificate by ID", async () => {
      const payload = { certificate: { certificateId: "cert-1" } };
      mockFetchSuccess(payload);

      const result = await fetchCertificate("cert-1");

      expect(result).toEqual(payload);
      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(calledUrl).toBe("/api/certificates/cert-1");
    });
  });

  describe("fetchRegulations", () => {
    it("returns available regulations", async () => {
      const payload = { regulations: ["colorado-sb205", "eu-ai-act"] };
      mockFetchSuccess(payload);

      const result = await fetchRegulations();

      expect(result).toEqual(payload);
    });
  });

  describe("fetchReport", () => {
    it("fetches a compliance report with chainId", async () => {
      const payload = { report: { reportId: "r1" } };
      mockFetchSuccess(payload);

      const result = await fetchReport("colorado-sb205", "c1");

      expect(result).toEqual(payload);
      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(calledUrl).toBe("/api/reports/colorado-sb205?chainId=c1");
    });
  });

  describe("error handling", () => {
    it("throws ApiError with status and message on non-ok response", async () => {
      mockFetchError(404, { error: "Chain not found: c99" });

      await expect(fetchChains()).rejects.toThrow(ApiError);
      try {
        await fetchChains();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(404);
        expect(apiErr.message).toBe("Chain not found: c99");
      }
    });

    it("falls back to statusText when response body is not JSON", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("not json")),
      } as Response);

      await expect(fetchChains()).rejects.toThrow("Internal Server Error");
    });
  });
});

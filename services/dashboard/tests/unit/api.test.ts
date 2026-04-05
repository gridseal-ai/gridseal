import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listChains,
  listEntries,
  getEntry,
  validateChainApi,
  getCertificate,
  getSessionEntries,
  getSubtree,
} from "../../src/api.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("api", () => {
  it("listChains calls GET /api/chains", async () => {
    const data = { chains: [{ chainId: "c1", entryCount: 5 }] };
    mockFetch.mockResolvedValue(jsonResponse(data));
    const result = await listChains();
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith("/api/chains", undefined);
  });

  it("listEntries builds query string with filters", async () => {
    const data = { chainId: "c1", entries: [], total: 0, offset: 0, limit: 20 };
    mockFetch.mockResolvedValue(jsonResponse(data));
    await listEntries("c1", 0, 20, { modelId: "gpt-4" });
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("/api/chains/c1/entries?");
    expect(url).toContain("modelId=gpt-4");
    expect(url).toContain("offset=0");
    expect(url).toContain("limit=20");
  });

  it("listEntries omits empty filter values", async () => {
    const data = { chainId: "c1", entries: [], total: 0, offset: 0, limit: 20 };
    mockFetch.mockResolvedValue(jsonResponse(data));
    await listEntries("c1", 10, 20);
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).not.toContain("modelId");
    expect(url).not.toContain("sessionId");
  });

  it("getEntry calls GET /api/chains/:chainId/entries/:entryId", async () => {
    const data = { entry: { entryId: "e1" } };
    mockFetch.mockResolvedValue(jsonResponse(data));
    await getEntry("c1", "e1");
    expect(mockFetch).toHaveBeenCalledWith("/api/chains/c1/entries/e1", undefined);
  });

  it("getSubtree calls GET /api/chains/:chainId/entries/:entryId/subtree", async () => {
    const data = { rootEntryId: "e1", entries: [] };
    mockFetch.mockResolvedValue(jsonResponse(data));
    await getSubtree("c1", "e1");
    expect(mockFetch).toHaveBeenCalledWith("/api/chains/c1/entries/e1/subtree", undefined);
  });

  it("getSessionEntries calls with sessionId filter and high limit", async () => {
    const data = { chainId: "c1", entries: [], total: 0, offset: 0, limit: 1000 };
    mockFetch.mockResolvedValue(jsonResponse(data));
    await getSessionEntries("c1", "s1");
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("sessionId=s1");
    expect(url).toContain("limit=1000");
  });

  it("validateChainApi calls POST /api/chains/:chainId/validate", async () => {
    const data = { valid: true, chainId: "c1", entryCount: 10 };
    mockFetch.mockResolvedValue(jsonResponse(data));
    const result = await validateChainApi("c1");
    expect(result.valid).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith("/api/chains/c1/validate", { method: "POST" });
  });

  it("getCertificate calls GET /api/certificates/:id", async () => {
    const data = { certificate: { certificateId: "cert1" } };
    mockFetch.mockResolvedValue(jsonResponse(data));
    await getCertificate("cert1");
    expect(mockFetch).toHaveBeenCalledWith("/api/certificates/cert1", undefined);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "Not found" }, 404));
    await expect(listChains()).rejects.toThrow("API 404");
  });

  it("listEntries includes all filter params when provided", async () => {
    const data = { chainId: "c1", entries: [], total: 0, offset: 0, limit: 20 };
    mockFetch.mockResolvedValue(jsonResponse(data));
    await listEntries("c1", 0, 20, {
      sessionId: "s1",
      modelId: "m1",
      actorId: "a1",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("sessionId=s1");
    expect(url).toContain("modelId=m1");
    expect(url).toContain("actorId=a1");
    expect(url).toContain("startDate=2026-01-01");
    expect(url).toContain("endDate=2026-12-31");
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ChainDetailPage } from "../../src/pages/chain-detail-page";
import type { ProofChainEntry } from "../../src/api/types";

vi.mock("../../src/api/client", () => ({
  getChain: vi.fn(),
  getChainEntries: vi.fn(),
  validateChain: vi.fn(),
}));

import { getChain, getChainEntries } from "../../src/api/client";

const mockGetChain = vi.mocked(getChain);
const mockGetChainEntries = vi.mocked(getChainEntries);

function makeEntry(overrides: Partial<ProofChainEntry> = {}): ProofChainEntry {
  return {
    entryId: "e1",
    chainId: "c1",
    sequenceNumber: 0,
    timestamp: "2025-01-01T00:00:00Z",
    entryType: "ai_decision",
    entryHash: "a".repeat(64),
    previousHash: null,
    parentEntryId: null,
    modelId: "gpt-4o",
    modelProvider: "openai",
    inputHash: "b".repeat(64),
    outputHash: "c".repeat(64),
    inputTokenCount: 100,
    outputTokenCount: 50,
    decisionType: "generation",
    confidenceScore: 0.95,
    reasoningCertificateId: null,
    provenanceId: null,
    sessionId: null,
    actorId: null,
    policyIds: [],
    tags: {},
    annotation: null,
    complianceMetadata: {},
    ...overrides,
  };
}

function renderWithRoute(chainId: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/chains/${chainId}`]}>
      <Routes>
        <Route path="/chains/:chainId" element={<ChainDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ChainDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders chain entries in a table after loading", async () => {
    const entry = makeEntry();
    mockGetChain.mockResolvedValue({ ok: true, data: { chainId: "c1", entryCount: 1 } });
    mockGetChainEntries.mockResolvedValue({
      ok: true,
      data: { chainId: "c1", entries: [entry], total: 1, offset: 0, limit: 50 },
    });

    renderWithRoute("c1");

    await waitFor(() => {
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    expect(screen.getByText("ai decision")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
  });

  it("shows validate button", async () => {
    mockGetChain.mockResolvedValue({ ok: true, data: { chainId: "c1", entryCount: 0 } });
    mockGetChainEntries.mockResolvedValue({
      ok: true,
      data: { chainId: "c1", entries: [], total: 0, offset: 0, limit: 50 },
    });

    renderWithRoute("c1");

    await waitFor(() => {
      expect(screen.getByText("Validate")).toBeInTheDocument();
    });
  });

  it("shows error when chain fetch fails", async () => {
    mockGetChain.mockResolvedValue({ ok: false, error: "Chain not found" });
    mockGetChainEntries.mockResolvedValue({ ok: false, error: "Chain not found" });

    renderWithRoute("c1");

    await waitFor(() => {
      expect(screen.getByText("Chain not found")).toBeInTheDocument();
    });
  });

  it("shows breadcrumb with link back to all chains", async () => {
    mockGetChain.mockResolvedValue({ ok: true, data: { chainId: "c1", entryCount: 0 } });
    mockGetChainEntries.mockResolvedValue({
      ok: true,
      data: { chainId: "c1", entries: [], total: 0, offset: 0, limit: 50 },
    });

    renderWithRoute("c1");

    await waitFor(() => {
      const link = screen.getByText("All Chains");
      expect(link.closest("a")).toHaveAttribute("href", "/");
    });
  });

  it("shows entry count in subtitle", async () => {
    mockGetChain.mockResolvedValue({ ok: true, data: { chainId: "c1", entryCount: 42 } });
    mockGetChainEntries.mockResolvedValue({
      ok: true,
      data: { chainId: "c1", entries: [], total: 0, offset: 0, limit: 50 },
    });

    renderWithRoute("c1");

    await waitFor(() => {
      expect(screen.getByText("42 entries")).toBeInTheDocument();
    });
  });

  it("shows pagination controls when total exceeds page size", async () => {
    const entries = Array.from({ length: 50 }, (_, i) =>
      makeEntry({ entryId: `e${i}`, sequenceNumber: i }),
    );
    mockGetChain.mockResolvedValue({ ok: true, data: { chainId: "c1", entryCount: 100 } });
    mockGetChainEntries.mockResolvedValue({
      ok: true,
      data: { chainId: "c1", entries, total: 100, offset: 0, limit: 50 },
    });

    renderWithRoute("c1");

    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
      expect(screen.getByText("Previous")).toBeInTheDocument();
      expect(screen.getByText("1 - 50 of 100")).toBeInTheDocument();
    });
  });

  it("does not show pagination when total fits in one page", async () => {
    const entries = [makeEntry()];
    mockGetChain.mockResolvedValue({ ok: true, data: { chainId: "c1", entryCount: 1 } });
    mockGetChainEntries.mockResolvedValue({
      ok: true,
      data: { chainId: "c1", entries, total: 1, offset: 0, limit: 50 },
    });

    renderWithRoute("c1");

    await waitFor(() => {
      expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    });

    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("renders model dash when modelId is null", async () => {
    const entry = makeEntry({ modelId: null });
    mockGetChain.mockResolvedValue({ ok: true, data: { chainId: "c1", entryCount: 1 } });
    mockGetChainEntries.mockResolvedValue({
      ok: true,
      data: { chainId: "c1", entries: [entry], total: 1, offset: 0, limit: 50 },
    });

    renderWithRoute("c1");

    await waitFor(() => {
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    const dashElements = screen.getAllByText("-");
    expect(dashElements.length).toBeGreaterThan(0);
  });
});

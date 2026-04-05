import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { EntryDetailPage } from "../../src/pages/entry-detail-page";
import type { ProofChainEntry } from "../../src/api/types";

vi.mock("../../src/api/client", () => ({
  getEntry: vi.fn(),
  getEntryChildren: vi.fn(),
  validateEntry: vi.fn(),
}));

import { getEntry, getEntryChildren } from "../../src/api/client";

const mockGetEntry = vi.mocked(getEntry);
const mockGetEntryChildren = vi.mocked(getEntryChildren);

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
    sessionId: "sess-1",
    actorId: "user-1",
    policyIds: ["policy-1"],
    tags: { env: "production" },
    annotation: "Test annotation",
    complianceMetadata: { framework: "EU AI Act" },
    ...overrides,
  };
}

function renderWithRoute(chainId: string, entryId: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/chains/${chainId}/entries/${entryId}`]}>
      <Routes>
        <Route path="/chains/:chainId/entries/:entryId" element={<EntryDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("EntryDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders entry details with all three tiers", async () => {
    const entry = makeEntry();
    mockGetEntry.mockResolvedValue({ ok: true, data: { entry } });
    mockGetEntryChildren.mockResolvedValue({ ok: true, data: { parentEntryId: "e1", children: [] } });

    renderWithRoute("c1", "e1");

    await waitFor(() => {
      expect(screen.getByText("Entry Detail")).toBeInTheDocument();
    });

    expect(screen.getByText("Tier 1: Chain Integrity")).toBeInTheDocument();
    expect(screen.getByText("Tier 2: AI Decision Context")).toBeInTheDocument();
    expect(screen.getByText("Tier 3: Compliance and Metadata")).toBeInTheDocument();
  });

  it("displays model information in Tier 2", async () => {
    const entry = makeEntry({ modelId: "claude-3-opus", modelProvider: "anthropic" });
    mockGetEntry.mockResolvedValue({ ok: true, data: { entry } });
    mockGetEntryChildren.mockResolvedValue({ ok: true, data: { parentEntryId: "e1", children: [] } });

    renderWithRoute("c1", "e1");

    await waitFor(() => {
      expect(screen.getByText("claude-3-opus")).toBeInTheDocument();
    });

    expect(screen.getByText("anthropic")).toBeInTheDocument();
  });

  it("displays confidence score as percentage", async () => {
    const entry = makeEntry({ confidenceScore: 0.87 });
    mockGetEntry.mockResolvedValue({ ok: true, data: { entry } });
    mockGetEntryChildren.mockResolvedValue({ ok: true, data: { parentEntryId: "e1", children: [] } });

    renderWithRoute("c1", "e1");

    await waitFor(() => {
      expect(screen.getByText("87.0%")).toBeInTheDocument();
    });
  });

  it("displays tags as key=value badges", async () => {
    const entry = makeEntry({ tags: { env: "staging", version: "2.0" } });
    mockGetEntry.mockResolvedValue({ ok: true, data: { entry } });
    mockGetEntryChildren.mockResolvedValue({ ok: true, data: { parentEntryId: "e1", children: [] } });

    renderWithRoute("c1", "e1");

    await waitFor(() => {
      expect(screen.getByText("env=staging")).toBeInTheDocument();
    });

    expect(screen.getByText("version=2.0")).toBeInTheDocument();
  });

  it("renders certificate link when reasoningCertificateId is set", async () => {
    const entry = makeEntry({ reasoningCertificateId: "cert-abc" });
    mockGetEntry.mockResolvedValue({ ok: true, data: { entry } });
    mockGetEntryChildren.mockResolvedValue({ ok: true, data: { parentEntryId: "e1", children: [] } });

    renderWithRoute("c1", "e1");

    await waitFor(() => {
      const link = screen.getByText("cert-abc");
      expect(link.closest("a")).toHaveAttribute("href", "/certificates/cert-abc");
    });
  });

  it("renders provenance link when provenanceId is set", async () => {
    const entry = makeEntry({ provenanceId: "prov-xyz" });
    mockGetEntry.mockResolvedValue({ ok: true, data: { entry } });
    mockGetEntryChildren.mockResolvedValue({ ok: true, data: { parentEntryId: "e1", children: [] } });

    renderWithRoute("c1", "e1");

    await waitFor(() => {
      const link = screen.getByText("prov-xyz");
      expect(link.closest("a")).toHaveAttribute("href", "/provenance/prov-xyz");
    });
  });

  it("renders child entries when they exist", async () => {
    const entry = makeEntry();
    const child = makeEntry({ entryId: "child-1", sequenceNumber: 1, entryType: "feedback", parentEntryId: "e1" });
    mockGetEntry.mockResolvedValue({ ok: true, data: { entry } });
    mockGetEntryChildren.mockResolvedValue({ ok: true, data: { parentEntryId: "e1", children: [child] } });

    renderWithRoute("c1", "e1");

    await waitFor(() => {
      expect(screen.getByText("Child Entries")).toBeInTheDocument();
    });

    expect(screen.getByText("child-1")).toBeInTheDocument();
  });

  it("does not render child entries section when no children", async () => {
    const entry = makeEntry();
    mockGetEntry.mockResolvedValue({ ok: true, data: { entry } });
    mockGetEntryChildren.mockResolvedValue({ ok: true, data: { parentEntryId: "e1", children: [] } });

    renderWithRoute("c1", "e1");

    await waitFor(() => {
      expect(screen.getByText("Entry Detail")).toBeInTheDocument();
    });

    expect(screen.queryByText("Child Entries")).not.toBeInTheDocument();
  });

  it("shows error on fetch failure", async () => {
    mockGetEntry.mockResolvedValue({ ok: false, error: "Entry not found" });
    mockGetEntryChildren.mockResolvedValue({ ok: false, error: "Entry not found" });

    renderWithRoute("c1", "e1");

    await waitFor(() => {
      expect(screen.getByText("Entry not found")).toBeInTheDocument();
    });
  });

  it("renders breadcrumb navigation", async () => {
    const entry = makeEntry();
    mockGetEntry.mockResolvedValue({ ok: true, data: { entry } });
    mockGetEntryChildren.mockResolvedValue({ ok: true, data: { parentEntryId: "e1", children: [] } });

    renderWithRoute("c1", "e1");

    await waitFor(() => {
      const chainsLink = screen.getByText("All Chains");
      expect(chainsLink.closest("a")).toHaveAttribute("href", "/");
    });

    const chainLinks = screen.getAllByText("c1");
    const chainBreadcrumb = chainLinks.find((el) => el.closest("a")?.getAttribute("href") === "/chains/c1");
    expect(chainBreadcrumb).toBeDefined();
  });

  it("shows validate button", async () => {
    const entry = makeEntry();
    mockGetEntry.mockResolvedValue({ ok: true, data: { entry } });
    mockGetEntryChildren.mockResolvedValue({ ok: true, data: { parentEntryId: "e1", children: [] } });

    renderWithRoute("c1", "e1");

    await waitFor(() => {
      expect(screen.getByText("Validate")).toBeInTheDocument();
    });
  });

  it("displays compliance metadata as JSON", async () => {
    const entry = makeEntry({ complianceMetadata: { framework: "Colorado AI Act" } });
    mockGetEntry.mockResolvedValue({ ok: true, data: { entry } });
    mockGetEntryChildren.mockResolvedValue({ ok: true, data: { parentEntryId: "e1", children: [] } });

    renderWithRoute("c1", "e1");

    await waitFor(() => {
      expect(screen.getByText(/Colorado AI Act/)).toBeInTheDocument();
    });
  });
});

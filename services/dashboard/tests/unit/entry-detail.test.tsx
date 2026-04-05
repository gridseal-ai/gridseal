import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { EntryDetailPage } from "../../src/pages/entry-detail.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

const MOCK_ENTRY = {
  entryId: "e1-uuid",
  chainId: "chain-1",
  sequenceNumber: 0,
  timestamp: "2026-01-01T00:00:00.000Z",
  entryType: "ai_decision",
  entryHash: "hash123",
  previousHash: null,
  parentEntryId: null,
  modelId: "gpt-4",
  modelProvider: "openai",
  inputHash: null,
  outputHash: null,
  inputTokenCount: null,
  outputTokenCount: null,
  decisionType: "classification",
  confidenceScore: 0.9,
  reasoningCertificateId: null,
  provenanceId: null,
  sessionId: "session-1",
  actorId: "agent-1",
  policyIds: [],
  tags: {},
  annotation: "Test entry",
  complianceMetadata: {},
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe("EntryDetailPage", () => {
  it("renders entry detail after loading", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ entry: MOCK_ENTRY }));

    render(
      <MemoryRouter initialEntries={["/chains/chain-1/entries/e1-uuid"]}>
        <Routes>
          <Route path="chains/:chainId/entries/:entryId" element={<EntryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Entry Detail")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("e1-uuid")).toBeInTheDocument());
    expect(screen.getByText("ai_decision")).toBeInTheDocument();
    expect(screen.getByText("gpt-4")).toBeInTheDocument();
  });

  it("shows session link when entry has sessionId", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ entry: MOCK_ENTRY }));

    render(
      <MemoryRouter initialEntries={["/chains/chain-1/entries/e1-uuid"]}>
        <Routes>
          <Route path="chains/:chainId/entries/:entryId" element={<EntryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("View session decision tree")).toBeInTheDocument());
  });

  it("shows error on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Not found" }),
      text: () => Promise.resolve("Not found"),
    });

    render(
      <MemoryRouter initialEntries={["/chains/chain-1/entries/e1-uuid"]}>
        <Routes>
          <Route path="chains/:chainId/entries/:entryId" element={<EntryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/API 404/)).toBeInTheDocument());
  });

  it("shows certificate panel when entry has certificateId", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ entry: { ...MOCK_ENTRY, reasoningCertificateId: "cert-1" } }),
    );

    render(
      <MemoryRouter initialEntries={["/chains/chain-1/entries/e1-uuid"]}>
        <Routes>
          <Route path="chains/:chainId/entries/:entryId" element={<EntryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Reasoning Certificate")).toBeInTheDocument());
  });

  it("has back to audit trail link", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ entry: MOCK_ENTRY }));

    render(
      <MemoryRouter initialEntries={["/chains/chain-1/entries/e1-uuid"]}>
        <Routes>
          <Route path="chains/:chainId/entries/:entryId" element={<EntryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Back to Audit Trail")).toBeInTheDocument();
  });
});

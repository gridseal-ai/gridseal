import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { SessionTreePage } from "../../src/pages/session-tree.js";

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

function makeEntry(id: string, parentId: string | null, seq: number) {
  return {
    entryId: id,
    chainId: "chain-1",
    sequenceNumber: seq,
    timestamp: "2026-01-01T00:00:00.000Z",
    entryType: "ai_decision",
    entryHash: `hash-${id}`,
    previousHash: null,
    parentEntryId: parentId,
    modelId: "gpt-4",
    modelProvider: "openai",
    inputHash: null,
    outputHash: null,
    inputTokenCount: null,
    outputTokenCount: null,
    decisionType: "routing",
    confidenceScore: 0.9,
    reasoningCertificateId: null,
    provenanceId: null,
    sessionId: "session-1",
    actorId: "orchestrator",
    policyIds: [],
    tags: { agent_role: "orchestrator" },
    annotation: null,
    complianceMetadata: {},
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("SessionTreePage", () => {
  it("renders heading with session ID", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/entries")) {
        return Promise.resolve(
          jsonResponse({
            chainId: "chain-1",
            entries: [makeEntry("root", null, 0)],
            total: 1,
            offset: 0,
            limit: 1000,
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({ chains: [{ chainId: "chain-1", entryCount: 1 }] }),
      );
    });

    render(
      <MemoryRouter initialEntries={["/chains/chain-1/sessions/session-1"]}>
        <Routes>
          <Route path="chains/:chainId/sessions/:sessionId" element={<SessionTreePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Decision Tree")).toBeInTheDocument();
    expect(screen.getByText("session-1")).toBeInTheDocument();
  });

  it("renders decision tree with entries", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/entries")) {
        return Promise.resolve(
          jsonResponse({
            chainId: "chain-1",
            entries: [
              makeEntry("root", null, 0),
              makeEntry("child", "root", 1),
            ],
            total: 2,
            offset: 0,
            limit: 1000,
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({ chains: [{ chainId: "chain-1", entryCount: 2 }] }),
      );
    });

    render(
      <MemoryRouter initialEntries={["/chains/chain-1/sessions/session-1"]}>
        <Routes>
          <Route path="chains/:chainId/sessions/:sessionId" element={<SessionTreePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("decision-tree")).toBeInTheDocument());
    const rects = document.querySelectorAll("svg rect");
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });

  it("shows error on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "error" }),
      text: () => Promise.resolve("error"),
    });

    render(
      <MemoryRouter initialEntries={["/chains/chain-1/sessions/session-1"]}>
        <Routes>
          <Route path="chains/:chainId/sessions/:sessionId" element={<SessionTreePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/API 500/)).toBeInTheDocument());
  });

  it("has back link to audit trail", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={["/chains/chain-1/sessions/session-1"]}>
        <Routes>
          <Route path="chains/:chainId/sessions/:sessionId" element={<SessionTreePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Back to Audit Trail")).toBeInTheDocument();
  });
});

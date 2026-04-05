import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuditTrailPage } from "../../src/pages/audit-trail.js";

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

function makeEntry(id: string, type: string) {
  return {
    entryId: id,
    chainId: "chain-1",
    sequenceNumber: 0,
    timestamp: "2026-01-01T00:00:00.000Z",
    entryType: type,
    entryHash: "hash",
    previousHash: null,
    parentEntryId: null,
    modelId: "gpt-4",
    modelProvider: null,
    inputHash: null,
    outputHash: null,
    inputTokenCount: null,
    outputTokenCount: null,
    decisionType: null,
    confidenceScore: null,
    reasoningCertificateId: null,
    provenanceId: null,
    sessionId: "s1",
    actorId: "actor-1",
    policyIds: [],
    tags: {},
    annotation: null,
    complianceMetadata: {},
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("AuditTrailPage", () => {
  it("renders the heading", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ chains: [] }));
    render(
      <MemoryRouter>
        <AuditTrailPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Audit Trail Explorer").length).toBeGreaterThanOrEqual(1);
  });

  it("displays chains after loading", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ chains: [{ chainId: "chain-1", entryCount: 5 }] }),
    );
    render(
      <MemoryRouter>
        <AuditTrailPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText("chain-1").length).toBeGreaterThanOrEqual(1));
  });

  it("loads entries when a chain is clicked", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/entries")) {
        return Promise.resolve(
          jsonResponse({
            chainId: "test-chain",
            entries: [makeEntry("e1", "ai_decision"), makeEntry("e2", "human_override")],
            total: 2,
            offset: 0,
            limit: 20,
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({ chains: [{ chainId: "test-chain", entryCount: 2 }] }),
      );
    });

    render(
      <MemoryRouter>
        <AuditTrailPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText("test-chain").length).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getAllByText("test-chain")[0]!);

    await waitFor(() => expect(screen.getAllByText("ai_decision").length).toBeGreaterThanOrEqual(1));
  });

  it("shows no chains message when empty", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ chains: [] }));
    render(
      <MemoryRouter>
        <AuditTrailPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText("No chains found.").length).toBeGreaterThanOrEqual(1));
  });

  it("shows error on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal error" }),
      text: () => Promise.resolve("Internal error"),
    });
    render(
      <MemoryRouter>
        <AuditTrailPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      const errors = screen.getAllByText(/API 500/);
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });
});

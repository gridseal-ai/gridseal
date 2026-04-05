import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { EntryTable } from "./entry-table.js";
import type { ProofChainEntry } from "../types.js";

function makeEntry(overrides: Partial<ProofChainEntry> = {}): ProofChainEntry {
  return {
    entryId: "entry-001",
    chainId: "chain-1",
    sequenceNumber: 0,
    timestamp: "2026-04-01T12:00:00.000Z",
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
    sessionId: "sess-abc-123-456",
    actorId: "user-42",
    policyIds: [],
    tags: {},
    annotation: null,
    complianceMetadata: {},
    ...overrides,
  };
}

afterEach(cleanup);

describe("EntryTable", () => {
  it("renders 'No entries found' when entries array is empty", () => {
    render(
      <MemoryRouter>
        <EntryTable entries={[]} chainId="c1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("No entries found.")).toBeInTheDocument();
  });

  it("renders a row for each entry with key fields", () => {
    const entries = [
      makeEntry({ entryId: "e1", sequenceNumber: 0 }),
      makeEntry({ entryId: "e2", sequenceNumber: 1, entryType: "human_override" }),
    ];

    render(
      <MemoryRouter>
        <EntryTable entries={entries} chainId="c1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("ai_decision")).toBeInTheDocument();
    expect(screen.getByText("human_override")).toBeInTheDocument();
    expect(screen.getAllByText("gpt-4o")).toHaveLength(2);
    expect(screen.getAllByText("user-42")).toHaveLength(2);
  });

  it("displays dash for null optional fields", () => {
    const entry = makeEntry({ modelId: null, actorId: null, sessionId: null });

    render(
      <MemoryRouter>
        <EntryTable entries={[entry]} chainId="c1" />
      </MemoryRouter>,
    );

    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("links each entry timestamp to the detail page", () => {
    const entry = makeEntry({ entryId: "e99" });

    render(
      <MemoryRouter>
        <EntryTable entries={[entry]} chainId="chain-x" />
      </MemoryRouter>,
    );

    const links = screen.getAllByRole("link");
    const timestampLink = links.find((l) =>
      l.getAttribute("href")?.includes("/entries/"),
    );
    expect(timestampLink).toHaveAttribute("href", "/chains/chain-x/entries/e99");
  });

  it("truncates long session IDs and hashes", () => {
    const entry = makeEntry({
      sessionId: "very-long-session-id-12345678",
      entryHash: "f".repeat(64),
    });

    render(
      <MemoryRouter>
        <EntryTable entries={[entry]} chainId="c1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("very-long-se...")).toBeInTheDocument();
    expect(screen.getByText("ffffffffffff...")).toBeInTheDocument();
  });
});

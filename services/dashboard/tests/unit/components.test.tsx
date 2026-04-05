import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EntryTypeBadge } from "../../src/components/entry-type-badge.tsx";
import { ValidationBadge } from "../../src/components/validation-badge.tsx";
import { HashDisplay } from "../../src/components/hash-display.tsx";
import { ChainCard } from "../../src/components/chain-card.tsx";
import { EntryTable } from "../../src/components/entry-table.tsx";
import { Pagination } from "../../src/components/pagination.tsx";
import { ErrorMessage } from "../../src/components/error-message.tsx";
import { Loading } from "../../src/components/loading.tsx";
import type { EntryType, ProofChainEntry } from "../../src/types.ts";

function makeEntry(overrides: Partial<ProofChainEntry> = {}): ProofChainEntry {
  return {
    entryId: "entry-001",
    chainId: "chain-001",
    sequenceNumber: 0,
    timestamp: "2026-04-01T12:00:00.000Z",
    entryType: "ai_decision",
    entryHash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    previousHash: null,
    parentEntryId: null,
    modelId: null,
    modelProvider: null,
    inputHash: null,
    outputHash: null,
    inputTokenCount: null,
    outputTokenCount: null,
    decisionType: null,
    confidenceScore: null,
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

describe("EntryTypeBadge", () => {
  const types: ReadonlyArray<{ type: EntryType; label: string }> = [
    { type: "ai_decision", label: "AI Decision" },
    { type: "human_override", label: "Human Override" },
    { type: "system_event", label: "System Event" },
    { type: "policy_check", label: "Policy Check" },
    { type: "data_access", label: "Data Access" },
    { type: "model_deployment", label: "Model Deployment" },
    { type: "feedback", label: "Feedback" },
    { type: "correction", label: "Correction" },
  ];

  for (const { type, label } of types) {
    it(`renders "${label}" for entry type "${type}"`, () => {
      render(<EntryTypeBadge entryType={type} />);
      expect(screen.getByTestId("entry-type-badge")).toHaveTextContent(label);
    });
  }
});

describe("ValidationBadge", () => {
  it('renders "Valid" for valid state', () => {
    render(<ValidationBadge state="valid" />);
    expect(screen.getByTestId("validation-badge")).toHaveTextContent("Valid");
  });

  it('renders "Invalid" for invalid state', () => {
    render(<ValidationBadge state="invalid" />);
    expect(screen.getByTestId("validation-badge")).toHaveTextContent("Invalid");
  });

  it('renders "Validating..." for pending state', () => {
    render(<ValidationBadge state="pending" />);
    expect(screen.getByTestId("validation-badge")).toHaveTextContent(
      "Validating...",
    );
  });

  it('renders "Not Validated" for idle state', () => {
    render(<ValidationBadge state="idle" />);
    expect(screen.getByTestId("validation-badge")).toHaveTextContent(
      "Not Validated",
    );
  });
});

describe("HashDisplay", () => {
  it("renders truncated hash with full hash in title", () => {
    const hash =
      "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";
    render(<HashDisplay hash={hash} />);
    const code = screen.getByTestId("hash-display").querySelector("code");
    expect(code).toHaveTextContent("a1b2c3d4...e9f0a1b2");
    expect(code).toHaveAttribute("title", hash);
  });

  it("renders a dash for null hash", () => {
    render(<HashDisplay hash={null} />);
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders a label when provided", () => {
    render(<HashDisplay hash="abcdef1234567890abcdef1234567890" label="Entry" />);
    expect(screen.getByText("Entry")).toBeInTheDocument();
  });
});

describe("ChainCard", () => {
  it("renders chain ID and entry count", () => {
    render(
      <MemoryRouter>
        <ChainCard chain={{ chainId: "test-chain-id", entryCount: 42 }} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("chain-card")).toHaveTextContent("42 entries");
    expect(screen.getByTestId("chain-card")).toHaveTextContent("test-chain-id");
  });

  it("uses singular 'entry' for count of 1", () => {
    render(
      <MemoryRouter>
        <ChainCard chain={{ chainId: "c1", entryCount: 1 }} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("chain-card")).toHaveTextContent("1 entry");
  });

  it("links to chain detail page", () => {
    render(
      <MemoryRouter>
        <ChainCard chain={{ chainId: "c1", entryCount: 5 }} />
      </MemoryRouter>,
    );
    const link = screen.getByTestId("chain-card");
    expect(link).toHaveAttribute("href", "/chains/c1");
  });
});

describe("EntryTable", () => {
  it("renders empty state when no entries", () => {
    render(
      <MemoryRouter>
        <EntryTable entries={[]} chainId="c1" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("empty-entries")).toHaveTextContent(
      "No entries found.",
    );
  });

  it("renders a table row for each entry", () => {
    const entries = [
      makeEntry({ entryId: "e1", sequenceNumber: 0 }),
      makeEntry({ entryId: "e2", sequenceNumber: 1 }),
    ];
    render(
      <MemoryRouter>
        <EntryTable entries={entries} chainId="c1" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("entry-table")).toBeInTheDocument();
    const rows = screen.getByTestId("entry-table").querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
  });

  it("displays model info when present", () => {
    const entries = [
      makeEntry({ modelId: "gpt-4o", modelProvider: "openai" }),
    ];
    render(
      <MemoryRouter>
        <EntryTable entries={entries} chainId="c1" />
      </MemoryRouter>,
    );
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    expect(screen.getByText("(openai)")).toBeInTheDocument();
  });

  it("displays token counts when present", () => {
    const entries = [
      makeEntry({ inputTokenCount: 150, outputTokenCount: 300 }),
    ];
    render(
      <MemoryRouter>
        <EntryTable entries={entries} chainId="c1" />
      </MemoryRouter>,
    );
    expect(screen.getByText("150 / 300")).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("renders nothing when total fits in one page", () => {
    const { container } = render(
      <Pagination offset={0} limit={100} total={50} onPageChange={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders page info and buttons when paginated", () => {
    render(
      <Pagination
        offset={0}
        limit={50}
        total={150}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByTestId("pagination")).toHaveTextContent("Page 1 of 3");
    expect(screen.getByTestId("pagination")).toHaveTextContent(
      "Showing 1-50 of 150",
    );
  });

  it("disables Previous on first page", () => {
    render(
      <Pagination
        offset={0}
        limit={50}
        total={150}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText("Previous")).toBeDisabled();
    expect(screen.getByText("Next")).toBeEnabled();
  });

  it("disables Next on last page", () => {
    render(
      <Pagination
        offset={100}
        limit={50}
        total={150}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByText("Next")).toBeDisabled();
    expect(screen.getByText("Previous")).toBeEnabled();
  });
});

describe("ErrorMessage", () => {
  it("renders the error message text", () => {
    render(<ErrorMessage message="Something broke" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something broke");
  });

  it("renders a retry button when onRetry is provided", () => {
    render(<ErrorMessage message="fail" onRetry={() => {}} />);
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("does not render retry button when onRetry is undefined", () => {
    render(<ErrorMessage message="fail" />);
    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });
});

describe("Loading", () => {
  it("renders default loading text", () => {
    render(<Loading />);
    expect(screen.getByTestId("loading")).toHaveTextContent("Loading...");
  });

  it("renders custom label", () => {
    render(<Loading label="Fetching chains..." />);
    expect(screen.getByTestId("loading")).toHaveTextContent(
      "Fetching chains...",
    );
  });
});

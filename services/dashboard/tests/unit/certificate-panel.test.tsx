import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CertificatePanel } from "../../src/components/certificate-panel.js";

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

const MOCK_CERT = {
  certificateId: "cert-1",
  entryId: "e-1",
  certificateHash: "hash123",
  claimsAnalysis: {
    claims: [
      { claim: "Model is accurate", status: "supported", evidence: "Test data shows 95% accuracy" },
    ],
  },
  evidenceChain: {
    steps: [
      { step: "Data collection", reasoning: "Gathered test samples" },
    ],
  },
  confidenceAssessment: {
    level: "high",
    score: 0.92,
    factors: [{ factor: "Data quality", impact: "positive" }],
    rationale: "High confidence based on evidence",
  },
  limitations: {
    items: [
      { limitation: "Small sample size", severity: "medium" },
    ],
  },
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe("CertificatePanel", () => {
  it("renders collapsed by default", () => {
    render(<CertificatePanel certificateId="cert-1" />);
    expect(screen.getByText("Reasoning Certificate")).toBeInTheDocument();
    expect(screen.getByText("Expand")).toBeInTheDocument();
  });

  it("loads and displays certificate on expand", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ certificate: MOCK_CERT }));

    render(<CertificatePanel certificateId="cert-1" />);
    fireEvent.click(screen.getByText("Expand"));

    await waitFor(() => expect(screen.getByText("Model is accurate")).toBeInTheDocument());
    expect(screen.getByText("Test data shows 95% accuracy")).toBeInTheDocument();
    expect(screen.getByText("Data collection")).toBeInTheDocument();
    expect(screen.getByText(/High confidence based on evidence/)).toBeInTheDocument();
    expect(screen.getByText("Small sample size")).toBeInTheDocument();
  });

  it("collapses when clicked again", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ certificate: MOCK_CERT }));

    render(<CertificatePanel certificateId="cert-1" />);
    fireEvent.click(screen.getByText("Expand"));

    await waitFor(() => expect(screen.getByText("Model is accurate")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Collapse"));
    expect(screen.queryByText("Model is accurate")).not.toBeInTheDocument();
  });

  it("shows error message on fetch failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server error" }),
      text: () => Promise.resolve("Server error"),
    });

    render(<CertificatePanel certificateId="cert-1" />);
    fireEvent.click(screen.getByText("Expand"));

    await waitFor(() => expect(screen.getByText(/API 500/)).toBeInTheDocument());
  });

  it("shows loading state", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<CertificatePanel certificateId="cert-1" />);
    fireEvent.click(screen.getByText("Expand"));

    expect(screen.getByText("Loading certificate...")).toBeInTheDocument();
  });
});

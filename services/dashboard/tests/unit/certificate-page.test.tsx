import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { CertificatePage } from "../../src/pages/certificate-page";
import type { ReasoningCertificate } from "../../src/api/types";

vi.mock("../../src/api/client", () => ({
  getCertificate: vi.fn(),
  verifyCertificate: vi.fn(),
}));

import { getCertificate, verifyCertificate } from "../../src/api/client";

const mockGetCertificate = vi.mocked(getCertificate);
const mockVerifyCertificate = vi.mocked(verifyCertificate);

function makeCertificate(overrides: Partial<ReasoningCertificate> = {}): ReasoningCertificate {
  return {
    certificateId: "cert-1",
    timestamp: "2025-01-01T00:00:00Z",
    modelId: "gpt-4o",
    modelProvider: "openai",
    certificateHash: "d".repeat(64),
    claims: [
      { claimId: "cl1", statement: "Output is factually accurate", supportingEvidenceIds: ["ev1"] },
    ],
    supportingEvidence: [
      { evidenceId: "ev1", evidenceType: "source_document", description: "Reference doc", source: "internal" },
    ],
    unsupportedClaims: [
      { statement: "100% accurate", reason: "Cannot guarantee" },
    ],
    assumptions: [
      { statement: "Input data is correct", criticality: "medium" },
    ],
    limitations: [
      { description: "Limited to English", impact: "Non-English input may fail" },
    ],
    confidenceAssessment: {
      level: "high",
      score: 0.88,
      rationale: "Strong evidence support",
    },
    ...overrides,
  };
}

function renderWithRoute(certificateId: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/certificates/${certificateId}`]}>
      <Routes>
        <Route path="/certificates/:certificateId" element={<CertificatePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CertificatePage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders certificate details on load", async () => {
    const cert = makeCertificate();
    mockGetCertificate.mockResolvedValue({ ok: true, data: { certificate: cert } });

    renderWithRoute("cert-1");

    await waitFor(() => {
      expect(screen.getByText("Reasoning Certificate")).toBeInTheDocument();
    });

    expect(screen.getByText("gpt-4o (openai)")).toBeInTheDocument();
    expect(screen.getByText("Strong evidence support")).toBeInTheDocument();
  });

  it("renders claims section", async () => {
    const cert = makeCertificate();
    mockGetCertificate.mockResolvedValue({ ok: true, data: { certificate: cert } });

    renderWithRoute("cert-1");

    await waitFor(() => {
      expect(screen.getByText("Output is factually accurate")).toBeInTheDocument();
    });

    expect(screen.getByText("Evidence: ev1")).toBeInTheDocument();
  });

  it("renders supporting evidence section", async () => {
    const cert = makeCertificate();
    mockGetCertificate.mockResolvedValue({ ok: true, data: { certificate: cert } });

    renderWithRoute("cert-1");

    await waitFor(() => {
      expect(screen.getByText("source_document")).toBeInTheDocument();
    });

    expect(screen.getByText("Reference doc")).toBeInTheDocument();
    expect(screen.getByText("Source: internal")).toBeInTheDocument();
  });

  it("renders unsupported claims", async () => {
    const cert = makeCertificate();
    mockGetCertificate.mockResolvedValue({ ok: true, data: { certificate: cert } });

    renderWithRoute("cert-1");

    await waitFor(() => {
      expect(screen.getByText("100% accurate")).toBeInTheDocument();
    });

    expect(screen.getByText("Reason: Cannot guarantee")).toBeInTheDocument();
  });

  it("renders assumptions with criticality badges", async () => {
    const cert = makeCertificate();
    mockGetCertificate.mockResolvedValue({ ok: true, data: { certificate: cert } });

    renderWithRoute("cert-1");

    await waitFor(() => {
      expect(screen.getByText("Input data is correct")).toBeInTheDocument();
    });

    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("renders limitations section", async () => {
    const cert = makeCertificate();
    mockGetCertificate.mockResolvedValue({ ok: true, data: { certificate: cert } });

    renderWithRoute("cert-1");

    await waitFor(() => {
      expect(screen.getByText("Limited to English")).toBeInTheDocument();
    });

    expect(screen.getByText("Impact: Non-English input may fail")).toBeInTheDocument();
  });

  it("shows verify button and calls verify API on click", async () => {
    const cert = makeCertificate();
    mockGetCertificate.mockResolvedValue({ ok: true, data: { certificate: cert } });
    mockVerifyCertificate.mockResolvedValue({
      ok: true,
      data: { valid: true, certificateId: "cert-1" },
    });

    renderWithRoute("cert-1");

    await waitFor(() => {
      expect(screen.getByText("Verify Integrity")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText("Verify Integrity"));

    await waitFor(() => {
      expect(screen.getByText("Verified")).toBeInTheDocument();
    });
  });

  it("shows error on fetch failure", async () => {
    mockGetCertificate.mockResolvedValue({ ok: false, error: "Certificate not found" });

    renderWithRoute("cert-1");

    await waitFor(() => {
      expect(screen.getByText("Certificate not found")).toBeInTheDocument();
    });
  });

  it("shows confidence level badge with correct variant", async () => {
    const cert = makeCertificate({
      confidenceAssessment: { level: "very_low", score: 0.1, rationale: "Weak" },
    });
    mockGetCertificate.mockResolvedValue({ ok: true, data: { certificate: cert } });

    renderWithRoute("cert-1");

    await waitFor(() => {
      expect(screen.getByText("very low (10%)")).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { ProvenancePage } from "../../src/pages/provenance-page";
import type { ModelProvenance } from "../../src/api/types";

vi.mock("../../src/api/client", () => ({
  getProvenance: vi.fn(),
  verifyProvenance: vi.fn(),
}));

import { getProvenance, verifyProvenance } from "../../src/api/client";

const mockGetProvenance = vi.mocked(getProvenance);
const mockVerifyProvenance = vi.mocked(verifyProvenance);

function makeProvenance(overrides: Partial<ModelProvenance> = {}): ModelProvenance {
  return {
    provenanceId: "prov-1",
    timestamp: "2025-01-01T00:00:00Z",
    bomVersion: "1.7",
    modelName: "GPT-4o",
    modelVersion: "2024-08-06",
    modelType: "generative",
    modelProvider: "OpenAI",
    modelDescription: "Large language model",
    modelAuthor: "OpenAI",
    modelLicense: "proprietary",
    provenanceHash: "e".repeat(64),
    trainingDatasets: [
      { datasetId: "ds1", name: "WebText", version: "2.0", source: "web", description: "Web crawl" },
    ],
    performanceMetrics: [
      { metricId: "m1", name: "MMLU", value: 0.886, slice: null, confidenceInterval: null },
    ],
    ethicalConsiderations: [
      { category: "Bias", description: "May reflect training data biases", mitigationStrategy: "RLHF" },
    ],
    externalReferences: [
      { referenceType: "paper", url: "https://arxiv.org/example", description: "Model paper" },
    ],
    ...overrides,
  };
}

function renderWithRoute(provenanceId: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/provenance/${provenanceId}`]}>
      <Routes>
        <Route path="/provenance/:provenanceId" element={<ProvenancePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProvenancePage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders model information on load", async () => {
    const prov = makeProvenance();
    mockGetProvenance.mockResolvedValue({ ok: true, data: { provenance: prov } });

    renderWithRoute("prov-1");

    await waitFor(() => {
      expect(screen.getByText("Model Provenance (AIBOM)")).toBeInTheDocument();
    });

    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    expect(screen.getByText("2024-08-06")).toBeInTheDocument();
    expect(screen.getAllByText("OpenAI").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("1.7")).toBeInTheDocument();
  });

  it("renders training datasets table", async () => {
    const prov = makeProvenance();
    mockGetProvenance.mockResolvedValue({ ok: true, data: { provenance: prov } });

    renderWithRoute("prov-1");

    await waitFor(() => {
      expect(screen.getByText("WebText")).toBeInTheDocument();
    });

    expect(screen.getByText("2.0")).toBeInTheDocument();
    expect(screen.getByText("web")).toBeInTheDocument();
  });

  it("renders performance metrics table", async () => {
    const prov = makeProvenance();
    mockGetProvenance.mockResolvedValue({ ok: true, data: { provenance: prov } });

    renderWithRoute("prov-1");

    await waitFor(() => {
      expect(screen.getByText("MMLU")).toBeInTheDocument();
    });

    expect(screen.getByText("0.8860")).toBeInTheDocument();
    expect(screen.getByText("overall")).toBeInTheDocument();
  });

  it("renders ethical considerations", async () => {
    const prov = makeProvenance();
    mockGetProvenance.mockResolvedValue({ ok: true, data: { provenance: prov } });

    renderWithRoute("prov-1");

    await waitFor(() => {
      expect(screen.getByText("Bias")).toBeInTheDocument();
    });

    expect(screen.getByText("May reflect training data biases")).toBeInTheDocument();
    expect(screen.getByText("Mitigation: RLHF")).toBeInTheDocument();
  });

  it("renders external references", async () => {
    const prov = makeProvenance();
    mockGetProvenance.mockResolvedValue({ ok: true, data: { provenance: prov } });

    renderWithRoute("prov-1");

    await waitFor(() => {
      expect(screen.getByText("paper:")).toBeInTheDocument();
    });
  });

  it("shows verify button and calls verify API on click", async () => {
    const prov = makeProvenance();
    mockGetProvenance.mockResolvedValue({ ok: true, data: { provenance: prov } });
    mockVerifyProvenance.mockResolvedValue({
      ok: true,
      data: { valid: true, provenanceId: "prov-1" },
    });

    renderWithRoute("prov-1");

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
    mockGetProvenance.mockResolvedValue({ ok: false, error: "Provenance not found" });

    renderWithRoute("prov-1");

    await waitFor(() => {
      expect(screen.getByText("Provenance not found")).toBeInTheDocument();
    });
  });

  it("renders model type as badge", async () => {
    const prov = makeProvenance();
    mockGetProvenance.mockResolvedValue({ ok: true, data: { provenance: prov } });

    renderWithRoute("prov-1");

    await waitFor(() => {
      expect(screen.getByText("generative")).toBeInTheDocument();
    });
  });

  it("shows dash for null optional fields", async () => {
    const prov = makeProvenance({
      modelDescription: null,
      modelAuthor: null,
      modelLicense: null,
    });
    mockGetProvenance.mockResolvedValue({ ok: true, data: { provenance: prov } });

    renderWithRoute("prov-1");

    await waitFor(() => {
      expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    });

    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("hides training datasets section when empty", async () => {
    const prov = makeProvenance({ trainingDatasets: [] });
    mockGetProvenance.mockResolvedValue({ ok: true, data: { provenance: prov } });

    renderWithRoute("prov-1");

    await waitFor(() => {
      expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    });

    expect(screen.queryByText("Training Datasets")).not.toBeInTheDocument();
  });
});

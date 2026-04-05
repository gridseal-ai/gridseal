import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ChainsPage } from "../../src/pages/chains-page";

vi.mock("../../src/api/client", () => ({
  listChains: vi.fn(),
}));

import { listChains } from "../../src/api/client";

const mockListChains = vi.mocked(listChains);

function renderWithRouter(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <ChainsPage />
    </MemoryRouter>,
  );
}

describe("ChainsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading spinner initially", () => {
    mockListChains.mockReturnValue(new Promise(() => {}));

    const { container } = renderWithRouter();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders chain list on successful fetch", async () => {
    mockListChains.mockResolvedValue({
      ok: true,
      data: {
        chains: [
          { chainId: "chain-001", entryCount: 42 },
          { chainId: "chain-002", entryCount: 7 },
        ],
      },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("chain-001")).toBeInTheDocument();
    });

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("chain-002")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders chain IDs as links to chain detail", async () => {
    mockListChains.mockResolvedValue({
      ok: true,
      data: { chains: [{ chainId: "my-chain", entryCount: 1 }] },
    });

    renderWithRouter();

    await waitFor(() => {
      const link = screen.getByText("my-chain");
      expect(link.closest("a")).toHaveAttribute("href", "/chains/my-chain");
    });
  });

  it("shows empty state when no chains exist", async () => {
    mockListChains.mockResolvedValue({
      ok: true,
      data: { chains: [] },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("No chains found")).toBeInTheDocument();
    });
  });

  it("shows error message on fetch failure", async () => {
    mockListChains.mockResolvedValue({
      ok: false,
      error: "Connection refused",
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Connection refused")).toBeInTheDocument();
    });
  });

  it("displays heading text", async () => {
    mockListChains.mockResolvedValue({
      ok: true,
      data: { chains: [{ chainId: "c1", entryCount: 1 }] },
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Proof Chains")).toBeInTheDocument();
    });
  });
});

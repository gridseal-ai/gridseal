import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ChainsPage } from "../../src/pages/chains.tsx";
import { NotFoundPage } from "../../src/pages/not-found.tsx";

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("ChainsPage", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shows loading state initially", () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <ChainsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("renders chains when API returns data", async () => {
    globalThis.fetch = mockFetch({
      chains: [
        { chainId: "chain-1", entryCount: 10 },
        { chainId: "chain-2", entryCount: 5 },
      ],
    });

    render(
      <MemoryRouter>
        <ChainsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("chains-grid")).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId("chain-card");
    expect(cards).toHaveLength(2);
  });

  it("renders empty state when no chains exist", async () => {
    globalThis.fetch = mockFetch({ chains: [] });

    render(
      <MemoryRouter>
        <ChainsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("empty-chains")).toBeInTheDocument();
    });
  });

  it("renders error state on API failure", async () => {
    globalThis.fetch = mockFetch({ error: "Server error" }, 500);

    render(
      <MemoryRouter>
        <ChainsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("error-message")).toBeInTheDocument();
    });
    expect(screen.getByText("Server error")).toBeInTheDocument();
  });

  it("retries on error when retry button is clicked", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "fail" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            chains: [{ chainId: "c1", entryCount: 1 }],
          }),
      });
    globalThis.fetch = fetchMock;

    render(
      <MemoryRouter>
        <ChainsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Retry"));

    await waitFor(() => {
      expect(screen.getByTestId("chains-grid")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("NotFoundPage", () => {
  it("renders 404 text and link back to chains", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Back to chains")).toHaveAttribute("href", "/");
  });
});

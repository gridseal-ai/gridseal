import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ChainVerifyPage } from "../../src/pages/chain-verify.js";

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

beforeEach(() => {
  mockFetch.mockReset();
});

describe("ChainVerifyPage", () => {
  it("renders heading and description", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ chains: [] }));
    render(
      <MemoryRouter>
        <ChainVerifyPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Chain Verification").length).toBeGreaterThanOrEqual(1);
  });

  it("lists chains with verify buttons", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ chains: [{ chainId: "c1", entryCount: 10 }] }),
    );
    render(
      <MemoryRouter>
        <ChainVerifyPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText("c1").length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText("Verify").length).toBeGreaterThanOrEqual(1);
  });

  it("shows PASS result after successful verification", async () => {
    let callCount = 0;
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      callCount++;
      if (init?.method === "POST") {
        return Promise.resolve(jsonResponse({ valid: true, chainId: "c1", entryCount: 5 }));
      }
      return Promise.resolve(jsonResponse({ chains: [{ chainId: "c1", entryCount: 5 }] }));
    });

    render(
      <MemoryRouter>
        <ChainVerifyPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText("Verify").length).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getAllByText("Verify")[0]!);

    await waitFor(() => expect(screen.getAllByText("PASS").length).toBeGreaterThanOrEqual(1));
  });

  it("shows FAIL result with error on failed verification", async () => {
    mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({
            valid: false,
            chainId: "c1",
            entryCount: 5,
            error: { type: "HASH_MISMATCH", message: "Entry 3 hash mismatch" },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ chains: [{ chainId: "c1", entryCount: 5 }] }));
    });

    render(
      <MemoryRouter>
        <ChainVerifyPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText("Verify").length).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getAllByText("Verify")[0]!);

    await waitFor(() => expect(screen.getAllByText("FAIL").length).toBeGreaterThanOrEqual(1));
    await waitFor(() => expect(screen.getAllByText(/HASH_MISMATCH/).length).toBeGreaterThanOrEqual(1));
  });

  it("shows Verify All Chains button when chains exist", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ chains: [{ chainId: "c1", entryCount: 5 }] }),
    );
    render(
      <MemoryRouter>
        <ChainVerifyPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText("Verify All Chains").length).toBeGreaterThanOrEqual(1));
  });
});

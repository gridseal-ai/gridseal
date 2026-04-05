import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ValidationBanner } from "../../src/components/validation-banner";

describe("ValidationBanner", () => {
  it("renders validate button in idle state", () => {
    const onValidate = vi.fn();

    render(<ValidationBanner onValidate={onValidate} />);

    expect(screen.getByText("Validate")).toBeInTheDocument();
  });

  it("shows loading state while validating", async () => {
    const onValidate = vi.fn().mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<ValidationBanner onValidate={onValidate} />);

    await user.click(screen.getByText("Validate"));

    expect(screen.getByText("Validating...")).toBeInTheDocument();
  });

  it("shows valid result after successful validation", async () => {
    const onValidate = vi.fn().mockResolvedValue({
      valid: true,
      chainId: "c1",
      entryCount: 10,
    });
    const user = userEvent.setup();

    render(<ValidationBanner onValidate={onValidate} />);

    await user.click(screen.getByText("Validate"));

    await waitFor(() => {
      expect(screen.getByText("Valid")).toBeInTheDocument();
    });

    expect(screen.getByText("Re-check")).toBeInTheDocument();
  });

  it("shows invalid result with error type", async () => {
    const onValidate = vi.fn().mockResolvedValue({
      valid: false,
      chainId: "c1",
      entryCount: 10,
      error: { type: "HASH_MISMATCH" },
    });
    const user = userEvent.setup();

    render(<ValidationBanner onValidate={onValidate} />);

    await user.click(screen.getByText("Validate"));

    await waitFor(() => {
      expect(screen.getByText("Invalid: HASH_MISMATCH")).toBeInTheDocument();
    });
  });

  it("resets to idle when re-check is clicked", async () => {
    const onValidate = vi.fn().mockResolvedValue({
      valid: true,
      chainId: "c1",
      entryCount: 10,
    });
    const user = userEvent.setup();

    render(<ValidationBanner onValidate={onValidate} />);

    await user.click(screen.getByText("Validate"));

    await waitFor(() => {
      expect(screen.getByText("Valid")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Re-check"));

    expect(screen.getByText("Validate")).toBeInTheDocument();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../../src/components/status-badge";
import { HashDisplay } from "../../src/components/hash-display";
import { LoadingSpinner } from "../../src/components/loading-spinner";
import { ErrorMessage } from "../../src/components/error-message";
import { DataField } from "../../src/components/data-field";

describe("StatusBadge", () => {
  it("renders children with the correct variant class", () => {
    render(<StatusBadge variant="success">Passed</StatusBadge>);

    const badge = screen.getByText("Passed");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-green-100");
  });

  it("renders error variant", () => {
    render(<StatusBadge variant="error">Failed</StatusBadge>);

    const badge = screen.getByText("Failed");
    expect(badge.className).toContain("bg-red-100");
  });

  it("renders warning variant", () => {
    render(<StatusBadge variant="warning">Warn</StatusBadge>);

    const badge = screen.getByText("Warn");
    expect(badge.className).toContain("bg-amber-100");
  });

  it("renders info variant", () => {
    render(<StatusBadge variant="info">Info</StatusBadge>);

    const badge = screen.getByText("Info");
    expect(badge.className).toContain("bg-blue-100");
  });

  it("renders neutral variant", () => {
    render(<StatusBadge variant="neutral">Neutral</StatusBadge>);

    const badge = screen.getByText("Neutral");
    expect(badge.className).toContain("bg-gray-100");
  });
});

describe("HashDisplay", () => {
  it("renders truncated hash with full hash as title", () => {
    const hash = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

    render(<HashDisplay hash={hash} />);

    const element = screen.getByTitle(hash);
    expect(element).toBeInTheDocument();
    expect(element.textContent).toBe("a1b2c3d4...e9f0a1b2");
  });

  it("renders dash for null hash", () => {
    render(<HashDisplay hash={null} />);

    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders optional label before the hash", () => {
    const hash = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

    render(<HashDisplay hash={hash} label="Entry" />);

    expect(screen.getByText("Entry:")).toBeInTheDocument();
  });
});

describe("LoadingSpinner", () => {
  it("renders an animated spinner element", () => {
    const { container } = render(<LoadingSpinner />);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });
});

describe("ErrorMessage", () => {
  it("displays the error message", () => {
    render(<ErrorMessage message="Something went wrong" />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders retry button when onRetry is provided", () => {
    const onRetry = () => {};
    render(<ErrorMessage message="Error" onRetry={onRetry} />);

    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("does not render retry button when onRetry is undefined", () => {
    render(<ErrorMessage message="Error" />);

    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });
});

describe("DataField", () => {
  it("renders label and children", () => {
    render(<DataField label="Model ID">gpt-4o</DataField>);

    expect(screen.getByText("Model ID")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
  });
});

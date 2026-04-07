import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Layout } from "../../src/components/layout.js";

describe("Layout", () => {
  it("renders GridSeal brand link", () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );
    expect(screen.getByText("GridSeal")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Audit Trail").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Verification").length).toBeGreaterThanOrEqual(1);
  });

  it("highlights active nav item based on path", () => {
    render(
      <MemoryRouter initialEntries={["/chains"]}>
        <Layout />
      </MemoryRouter>,
    );
    const links = screen.getAllByText("Audit Trail");
    const activeLink = links.find((el) => el.className.includes("text-celestir-stardust"));
    expect(activeLink).toBeTruthy();
  });
});

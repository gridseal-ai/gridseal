import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Pagination } from "./pagination.js";

afterEach(cleanup);

describe("Pagination", () => {
  it("displays the correct range and page info", () => {
    render(
      <Pagination offset={0} limit={25} total={100} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText(/Showing 1-25 of 100/)).toBeInTheDocument();
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("disables Previous button on first page", () => {
    render(
      <Pagination offset={0} limit={25} total={100} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText("Previous")).toBeDisabled();
    expect(screen.getByText("Next")).not.toBeDisabled();
  });

  it("disables Next button on last page", () => {
    render(
      <Pagination offset={75} limit={25} total={100} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText("Previous")).not.toBeDisabled();
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("calls onPageChange with correct offset on Next click", () => {
    const onChange = vi.fn();
    render(
      <Pagination offset={25} limit={25} total={100} onPageChange={onChange} />,
    );

    fireEvent.click(screen.getByText("Next"));
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it("calls onPageChange with correct offset on Previous click", () => {
    const onChange = vi.fn();
    render(
      <Pagination offset={50} limit={25} total={100} onPageChange={onChange} />,
    );

    fireEvent.click(screen.getByText("Previous"));
    expect(onChange).toHaveBeenCalledWith(25);
  });

  it("handles single page correctly", () => {
    render(
      <Pagination offset={0} limit={25} total={10} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText(/Showing 1-10 of 10/)).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeDisabled();
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("clamps range display when total is zero", () => {
    render(
      <Pagination offset={0} limit={25} total={0} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText(/Showing 0-0 of 0/)).toBeInTheDocument();
  });
});

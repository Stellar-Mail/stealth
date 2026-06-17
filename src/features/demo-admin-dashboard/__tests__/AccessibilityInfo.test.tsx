import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AccessibilityInfo } from "../components/AccessibilityInfo";

describe("AccessibilityInfo component", () => {
  test("renders checklist items", () => {
    render(<AccessibilityInfo />);
    const checklistItems = screen.getAllByRole("listitem");
    expect(checklistItems).toHaveLength(7);
    expect(screen.getByText(/keyboard‑focusable/i)).toBeInTheDocument();
    expect(screen.getByText(/aria‑labels/i)).toBeInTheDocument();
  });

  test("toggles expansion", () => {
    render(<AccessibilityInfo />);
    const button = screen.getByRole("button", { name: /accessibility guide/i });
    // Initially collapsed
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    // Expand
    fireEvent.click(button);
    expect(screen.getByRole("list")).toBeInTheDocument();
    // Collapse again
    fireEvent.click(button);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

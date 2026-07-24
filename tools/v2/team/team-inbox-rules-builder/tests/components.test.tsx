// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { RulesWorkspace } from "../components/RulesWorkspace";
import { mockRules } from "../fixtures/rules.fixtures";

afterEach(() => {
  cleanup();
});

describe("RulesWorkspace (#691)", () => {
  it("renders the heading and seeded rules", () => {
    render(<RulesWorkspace initialRules={mockRules} />);
    expect(screen.getByRole("heading", { name: "Inbox Rules" })).toBeDefined();
    expect(screen.getByText("High priority from executives")).toBeDefined();
  });

  it("exposes an accessible label per rule in the list", () => {
    render(<RulesWorkspace initialRules={mockRules} />);
    const firstRule = screen.getByRole("button", {
      name: /High priority from executives, Active/i,
    });
    expect(firstRule).toBeDefined();
    expect(firstRule.getAttribute("aria-label")).toMatch(/press enter to edit/i);
  });

  it("moves focus with ArrowDown / ArrowUp in the rule list", () => {
    render(<RulesWorkspace initialRules={mockRules} />);
    const buttons = screen.getAllByRole("button", { name: /, (Active|Inactive)/i });
    const first = buttons[0] as HTMLButtonElement;
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "ArrowDown" });
    const second = buttons[1] as HTMLButtonElement;
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "ArrowUp" });
    expect(document.activeElement).toBe(first);
  });

  it("opens the builder with labeled fields when a rule is selected", () => {
    render(<RulesWorkspace initialRules={mockRules} />);
    const first = screen.getByRole("button", { name: /High priority from executives/i });
    fireEvent.click(first);
    expect(screen.getByLabelText("Name")).toBeDefined();
    expect(screen.getByLabelText("Rule enabled")).toBeDefined();
  });

  it("shows inline validation when saving without a name", () => {
    render(<RulesWorkspace initialRules={mockRules} />);
    fireEvent.click(screen.getByRole("button", { name: "New rule" }));
    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    expect(screen.getAllByText("Rule name is required.").length).toBeGreaterThan(0);
  });

  it("announces success after creating a rule", async () => {
    render(<RulesWorkspace initialRules={mockRules} />);
    fireEvent.click(screen.getByRole("button", { name: "New rule" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Triage newsletters" } });
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    expect(await screen.findByText("Rule created.")).toBeDefined();
  });
});

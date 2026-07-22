// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KnowledgeBaseSuggestion } from "../KnowledgeBaseSuggestion";

const first = <T,>(els: T[]): T => els[0];

describe("KnowledgeBaseSuggestion", () => {
  it("renders the idle prompt by default", () => {
    render(<KnowledgeBaseSuggestion />);
    expect(screen.getAllByText(/Click "Analyze Thread" to fetch/i)[0]).toBeInTheDocument();
  });

  it("shows the loading spinner after clicking Analyze Thread", async () => {
    const user = userEvent.setup();
    render(<KnowledgeBaseSuggestion />);
    await user.click(first(screen.getAllByRole("button", { name: /Analyze Thread/i })));
    expect(screen.getAllByLabelText(/Analyzing email content/i)[0]).toBeInTheDocument();
  });

  it("shows the empty state after clicking No Matches Found", async () => {
    const user = userEvent.setup();
    render(<KnowledgeBaseSuggestion />);
    await user.click(first(screen.getAllByRole("button", { name: /No Matches Found/i })));
    expect(screen.getAllByText(/No suggestions found/i)[0]).toBeInTheDocument();
  });

  it("shows the error alert after clicking Simulate Error", async () => {
    const user = userEvent.setup();
    render(<KnowledgeBaseSuggestion />);
    await user.click(first(screen.getAllByRole("button", { name: /Simulate Error/i })));
    expect(screen.getAllByRole("alert")[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Search service unavailable/i)[0]).toBeInTheDocument();
  });

  it("shows suggested articles after clicking View Suggestions", async () => {
    const user = userEvent.setup();
    render(<KnowledgeBaseSuggestion />);
    await user.click(first(screen.getAllByRole("button", { name: /View Suggestions/i })));
    expect(
      screen.getAllByRole("list", { name: /Suggested Articles List/i })[0],
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Configuring Wallet Authentication/i)[0]).toBeInTheDocument();
  });

  it("exposes an accessible region labelled for screen readers", () => {
    render(<KnowledgeBaseSuggestion />);
    expect(
      screen.getAllByRole("region", { name: /Knowledge Base Suggestions/i })[0],
    ).toBeInTheDocument();
  });
});

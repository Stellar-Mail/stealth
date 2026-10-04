// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ComposeButton } from "@/components/mail/ComposeButton";

afterEach(cleanup);

describe("Compose launcher", () => {
  it("keeps one accessible button and opens the existing composer", () => {
    const onCompose = vi.fn();
    render(<ComposeButton onCompose={onCompose} />);
    const button = screen.getByRole("button", { name: "Compose Ctrl+N" });
    expect(button.getAttribute("type")).toBe("button");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(button.querySelector(".compose-launcher__face")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    fireEvent.click(button);
    expect(onCompose).toHaveBeenCalledOnce();
  });

  it("keeps the collapsed launcher named without a crowded shortcut badge", () => {
    render(<ComposeButton collapsed onCompose={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Compose" });
    expect(button.getAttribute("title")).toBe("Compose (Ctrl+N)");
    expect(button.className).toContain("compose-launcher--collapsed");
    expect(screen.queryByText("Ctrl+N")).toBeNull();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesProvider } from "@/features/preferences/PreferencesProvider";
import { usePreferences } from "@/features/preferences/usePreferences";

function Controls() {
  const { preferences, setPreferences } = usePreferences();
  return (
    <button onClick={() => setPreferences({ ...preferences, theme: "light" })}>Use cream</button>
  );
}

function Page({ name }: { name: string }) {
  const { preferences } = usePreferences();
  return (
    <p>
      {name}: {preferences.theme}
    </p>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe("app-wide preferences", () => {
  it("keeps the app usable when browser privacy settings deny storage", async () => {
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Denied", "SecurityError");
    });
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Denied", "SecurityError");
    });
    try {
      render(
        <PreferencesProvider>
          <Controls />
          <Page name="Inbox" />
        </PreferencesProvider>,
      );
      await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
      fireEvent.click(screen.getByText("Use cream"));
      await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
      expect(screen.getByText("Inbox: light")).toBeTruthy();
    } finally {
      read.mockRestore();
      write.mockRestore();
    }
  });

  it("restores the saved light theme outside the inbox", async () => {
    localStorage.setItem("stealth-ui-preferences", JSON.stringify({ theme: "light" }));
    render(
      <PreferencesProvider>
        <Page name="Sign in" />
      </PreferencesProvider>,
    );
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    expect(screen.getByText("Sign in: light")).toBeTruthy();
  });

  it("shares one theme across route changes and persists it", async () => {
    const view = render(
      <PreferencesProvider>
        <Controls />
        <Page name="Inbox" />
      </PreferencesProvider>,
    );
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    fireEvent.click(screen.getByText("Use cream"));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    view.rerender(
      <PreferencesProvider>
        <Page name="Calendar" />
      </PreferencesProvider>,
    );
    expect(screen.getByText("Calendar: light")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("stealth-ui-preferences")!).theme).toBe("light");
  });
});

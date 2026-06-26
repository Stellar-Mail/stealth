// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeContext";

const TestComponent = () => {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-val">{theme}</span>
      <button data-testid="toggle-btn" onClick={toggleTheme}>
        Toggle
      </button>
      <button data-testid="set-dark-btn" onClick={() => setTheme("dark")}>
        Set Dark
      </button>
      <button data-testid="set-light-btn" onClick={() => setTheme("light")}>
        Set Light
      </button>
    </div>
  );
};

describe("ThemeContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");

    // Mock matchMedia for jsdom
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("should initialize with default theme", () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    const themeVal = getByTestId("theme-val").textContent;
    expect(themeVal).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("should change theme when toggleTheme is called", () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    const toggleBtn = getByTestId("toggle-btn");

    // Toggle to dark
    act(() => {
      toggleBtn.click();
    });
    expect(getByTestId("theme-val").textContent).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("theme")).toBe("dark");

    // Toggle back to light
    act(() => {
      toggleBtn.click();
    });
    expect(getByTestId("theme-val").textContent).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("theme")).toBe("light");
  });

  it("should change theme when setTheme is called directly", () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    const setDarkBtn = getByTestId("set-dark-btn");
    const setLightBtn = getByTestId("set-light-btn");

    act(() => {
      setDarkBtn.click();
    });
    expect(getByTestId("theme-val").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      setLightBtn.click();
    });
    expect(getByTestId("theme-val").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("should initialize from localStorage if a theme preference is stored", () => {
    window.localStorage.setItem("theme", "dark");

    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    expect(getByTestId("theme-val").textContent).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});

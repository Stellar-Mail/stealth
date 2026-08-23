/**
 * @vitest-environment jsdom
 */
// ---------------------------------------------------------------------------
// BETA-052 (Issue #1959) — BootstrapStateView component tests.
//
// The acceptance criteria require "Render deterministic loading, retryable
// outage, maintenance, onboarding, suspended, and active branches." This
// suite verifies that the state view renders the correct visual branch for
// each bootstrap state.
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { BootstrapStateView } from "@/features/identity/BootstrapStateView";

const mock = vi.hoisted(() => {
  let branch: string = "loading";
  let data: unknown = null;
  let error: unknown = null;
  let isRetrying = false;
  return {
    get branch() {
      return branch;
    },
    get data() {
      return data;
    },
    get error() {
      return error;
    },
    get isRetrying() {
      return isRetrying;
    },
    setBranch(value: string) {
      branch = value;
    },
    setData(value: unknown) {
      data = value;
    },
    setError(value: unknown) {
      error = value;
    },
    setIsRetrying(value: boolean) {
      isRetrying = value;
    },
  };
});

vi.mock("@/features/identity/useBootstrap", () => ({
  useBootstrap: () => ({
    branch: mock.branch,
    data: mock.data,
    isLoading: false,
    error: mock.error,
    retry: vi.fn(),
    isRetrying: mock.isRetrying,
  }),
}));

describe("BootstrapStateView (BETA-052)", () => {
  it("renders the loading skeleton with an accessible status label", () => {
    mock.setBranch("loading");
    mock.setData(null);
    mock.setError(null);

    render(<BootstrapStateView />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByLabelText("Loading application state")).toBeTruthy();
  });

  it("renders the suspended view with a heading and support link", () => {
    mock.setBranch("suspended");
    mock.setData({ user: { userId: "user_abc" } });
    mock.setError(null);

    render(<BootstrapStateView />);
    expect(screen.getByRole("heading", { name: "Account suspended" })).toBeTruthy();
    expect(screen.getByText(/suspended due to security/)).toBeTruthy();
    expect(screen.getByText("Contact support to appeal")).toBeTruthy();
  });

  it("renders the outage view with a retry button", () => {
    mock.setBranch("outage");
    mock.setData(null);
    mock.setError({
      code: "server_error",
      message: "The service is temporarily unavailable.",
      retryable: true,
    });

    render(<BootstrapStateView />);
    expect(screen.getByRole("heading", { name: "Service temporarily unavailable" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Retry connection/i })).toBeTruthy();
  });

  it("renders the outage view with an offline-specific heading when error code is offline", () => {
    mock.setBranch("outage");
    mock.setData(null);
    mock.setError({
      code: "offline",
      message: "You appear to be offline. Check your network connection.",
      retryable: true,
    });

    render(<BootstrapStateView />);
    expect(screen.getByRole("heading", { name: "You are offline" })).toBeTruthy();
  });

  it("renders the outage view when the maintenance branch is active", () => {
    mock.setBranch("maintenance");
    mock.setData(null);
    mock.setError({
      code: "server_error",
      message: "Scheduled maintenance in progress.",
      retryable: true,
    });

    render(<BootstrapStateView />);
    expect(screen.getByRole("heading", { name: "Service temporarily unavailable" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Retry connection/i })).toBeTruthy();
  });

  it("returns null for the active branch (app shell renders children)", () => {
    mock.setBranch("active");
    mock.setData({
      user: { userId: "user_active" },
    });
    mock.setError(null);

    const { container } = render(<BootstrapStateView />);
    expect(container.innerHTML).toBe("");
  });

  it("displays draft-preservation message on the retryable outage view", () => {
    mock.setBranch("outage");
    mock.setData(null);
    mock.setError({
      code: "timeout",
      message: "Startup connection timed out. Please retry.",
      retryable: true,
    });

    render(<BootstrapStateView />);
    expect(screen.getByText(/local draft and mailbox data remain safely preserved/)).toBeTruthy();
  });

  it("shows account ID on the suspended view when user data is present", () => {
    mock.setBranch("suspended");
    mock.setData({ user: { userId: "user_suspended_123" } });
    mock.setError(null);

    render(<BootstrapStateView />);
    expect(screen.getByText("Account ID: user_suspended_123")).toBeTruthy();
  });
});

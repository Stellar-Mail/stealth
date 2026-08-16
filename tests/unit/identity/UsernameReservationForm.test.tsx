// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UsernameReservationForm } from "../../../src/features/identity/components/UsernameReservationForm";

const walletAddress = `G${"A".repeat(55)}`;

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function reserveButton() {
  return screen.getByRole("button", { name: /reserve username/i }) as HTMLButtonElement;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("UsernameReservationForm", () => {
  it("shows an inline validation message for a reserved word without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(UsernameReservationForm, { walletAddress }));

    fireEvent.change(screen.getByLabelText("Choose your Stealth username"), {
      target: { value: "admin" },
    });

    await waitFor(() => {
      expect(screen.getByText(/reserved username/i)).toBeTruthy();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reserveButton().disabled).toBe(true);
  });

  it("checks availability and enables reservation for an available username", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { username: "alice", available: true } }));
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(UsernameReservationForm, { walletAddress }));

    fireEvent.change(screen.getByLabelText("Choose your Stealth username"), {
      target: { value: "alice" },
    });

    await waitFor(
      () => {
        expect(screen.getByText(/alice@stealth\.me is available/i)).toBeTruthy();
      },
      { timeout: 2000 },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/identity/usernames/alice/availability",
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(reserveButton().disabled).toBe(false);
  });

  it("shows a taken message and keeps reservation disabled for an unavailable username", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: { username: "alice", available: false } }));
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(UsernameReservationForm, { walletAddress }));

    fireEvent.change(screen.getByLabelText("Choose your Stealth username"), {
      target: { value: "alice" },
    });

    await waitFor(
      () => {
        expect(screen.getByText(/alice@stealth\.me is already taken/i)).toBeTruthy();
      },
      { timeout: 2000 },
    );

    expect(reserveButton().disabled).toBe(true);
  });

  it("reserves an available username and shows both address forms on success", async () => {
    const record = {
      username: "alice",
      ownerAddress: walletAddress,
      stealthAddress: "alice@stealth.me",
      federationAddress: "alice*stealth.me",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: { username: "alice", available: true } }))
      .mockResolvedValueOnce(jsonResponse(201, { data: record }));
    vi.stubGlobal("fetch", fetchMock);

    const onReserved = vi.fn();
    render(createElement(UsernameReservationForm, { walletAddress, onReserved }));

    fireEvent.change(screen.getByLabelText("Choose your Stealth username"), {
      target: { value: "alice" },
    });

    await waitFor(
      () => {
        expect(reserveButton().disabled).toBe(false);
      },
      { timeout: 2000 },
    );

    fireEvent.click(reserveButton());

    await waitFor(() => {
      expect(screen.getByText(/username reserved/i)).toBeTruthy();
    });

    expect(screen.getByText("alice@stealth.me")).toBeTruthy();
    expect(screen.getByText(/alice\*stealth\.me/)).toBeTruthy();
    expect(onReserved).toHaveBeenCalledWith(record);

    const reserveCall = fetchMock.mock.calls[1];
    expect(reserveCall[0]).toBe("/api/v1/identity/usernames");
    expect(reserveCall[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ "x-stealth-address": walletAddress }),
    });
  });

  it("shows an error message when reservation fails server-side", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: { username: "alice", available: true } }))
      .mockResolvedValueOnce(
        jsonResponse(409, { error: { code: "username_taken", message: "Not available" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(UsernameReservationForm, { walletAddress }));

    fireEvent.change(screen.getByLabelText("Choose your Stealth username"), {
      target: { value: "alice" },
    });

    await waitFor(
      () => {
        expect(reserveButton().disabled).toBe(false);
      },
      { timeout: 2000 },
    );

    fireEvent.click(reserveButton());

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toMatch(/not available/i);
  });
});

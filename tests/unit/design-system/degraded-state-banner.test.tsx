/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DegradedStateBanner } from "@/features/design-system";
import { classifyAppFailure, ApiClientError } from "@/lib/api";

describe("DegradedStateBanner (BETA-071)", () => {
  it("renders retry, sign in, copy support ID, and work-kept for an unauthorized failure", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const failure = classifyAppFailure(
      new ApiClientError({
        code: "unauthorized",
        message: "expired",
        status: 401,
        retryable: false,
        retryClassification: "none",
        requestId: "req_support",
      }),
    );

    const onRetry = vi.fn();
    const onReauthenticate = vi.fn();
    render(
      <DegradedStateBanner
        failure={{
          ...failure,
          actions: ["retry", "reauthenticate", "copy_support_id", "preserve_unsent_work"],
        }}
        onRetry={onRetry}
        onReauthenticate={onReauthenticate}
      />,
    );

    expect(screen.getByText("Work kept")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    fireEvent.click(screen.getByRole("button", { name: /copy support id/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onReauthenticate).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("req_support");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrustBadge } from "./trust-badge";

describe("TrustBadge accessibility", () => {
  it("names tooltip badges and makes the trigger keyboard reachable", () => {
    const markup = renderToStaticMarkup(<TrustBadge state="verified" showLabel={false} />);

    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('aria-label="Verified: This sender');
    expect(markup).toContain("cryptographically verified");
    expect(markup).toContain("sr-only");
  });

  it("does not add a tab stop when tooltip behavior is disabled", () => {
    const markup = renderToStaticMarkup(
      <TrustBadge state="paid" showLabel={false} showTooltip={false} />,
    );

    expect(markup).not.toContain("tabindex=");
    expect(markup).toContain("Paid");
  });
});

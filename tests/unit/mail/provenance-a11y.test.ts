import { describe, expect, it } from "vitest";

import {
  copyFieldAriaLabel,
  inspectFieldAriaLabel,
  provenanceStatusHeading,
  technicalProvenanceToggleLabel,
  timelineStepAriaLabel,
  timelineStepStatusLabel,
} from "../../../src/components/mail/provenance-a11y";
import type { ProvenanceTimelineItem } from "../../../src/components/mail/provenance";

describe("provenance accessibility labels", () => {
  it("maps timeline statuses to screen-reader text", () => {
    expect(timelineStepStatusLabel("complete")).toBe("Complete");
    expect(timelineStepStatusLabel("pending")).toBe("Pending");
    expect(timelineStepStatusLabel("skipped")).toBe("Skipped");
  });

  it("describes the provenance security summary heading", () => {
    expect(provenanceStatusHeading(true, false)).toBe("Secure on-chain route");
    expect(provenanceStatusHeading(false, true)).toBe("SMTP bridged, unverified");
    expect(provenanceStatusHeading(false, false)).toBe("Awaiting envelope proof");
  });

  it("announces copy control state", () => {
    expect(copyFieldAriaLabel("Receipt Record", false)).toBe("Copy Receipt Record");
    expect(copyFieldAriaLabel("Receipt Record", true)).toBe("Receipt Record copied to clipboard");
  });

  it("names inspect controls", () => {
    expect(inspectFieldAriaLabel("Message Hash")).toBe("Inspect Message Hash");
  });

  it("labels the technical provenance disclosure toggle", () => {
    expect(technicalProvenanceToggleLabel(false)).toBe("Show technical provenance details");
    expect(technicalProvenanceToggleLabel(true)).toBe("Hide technical provenance details");
  });

  it("builds a full timeline step announcement", () => {
    const item: ProvenanceTimelineItem = {
      key: "receiptRecord",
      title: "Read receipt",
      description: "Recipient opened the message.",
      status: "complete",
      timestamp: "10:42 AM",
    };

    expect(timelineStepAriaLabel(item)).toBe("Read receipt, Complete, 10:42 AM");
  });
});

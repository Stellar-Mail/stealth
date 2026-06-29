import type { ProvenanceTimelineItem } from "./provenance";

/** Screen-reader label for a proof timeline step status. */
export function timelineStepStatusLabel(status: ProvenanceTimelineItem["status"]): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "pending":
      return "Pending";
    case "skipped":
      return "Skipped";
    default:
      return "Unknown";
  }
}

/** Accessible name for the provenance security summary heading. */
export function provenanceStatusHeading(isVerified: boolean, isSpam: boolean): string {
  if (isVerified) return "Secure on-chain route";
  if (isSpam) return "SMTP bridged, unverified";
  return "Awaiting envelope proof";
}

/** Accessible name for copy-to-clipboard controls on provenance fields. */
export function copyFieldAriaLabel(label: string, copied: boolean): string {
  return copied ? `${label} copied to clipboard` : `Copy ${label}`;
}

/** Accessible name for inspect controls on provenance fields. */
export function inspectFieldAriaLabel(label: string): string {
  return `Inspect ${label}`;
}

/** Accessible name for the technical provenance disclosure toggle. */
export function technicalProvenanceToggleLabel(expanded: boolean): string {
  return expanded ? "Hide technical provenance details" : "Show technical provenance details";
}

/** Full step announcement for timeline list items. */
export function timelineStepAriaLabel(item: ProvenanceTimelineItem): string {
  return `${item.title}, ${timelineStepStatusLabel(item.status)}${item.timestamp ? `, ${item.timestamp}` : ""}`;
}

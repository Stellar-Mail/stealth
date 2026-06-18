import type { ContactExtractionRequest } from "./types";

export const sampleContactRequests: ContactExtractionRequest[] = [
  {
    id: "vendor-renewal",
    sourceLabel: "Vendor renewal thread",
    subject: "Renewal terms for Atlas Search",
    from: "Maya Chen <maya.chen@atlas.example>",
    body: `Hi,

Please coordinate the renewal with Jordan Patel at Atlas Systems.
Jordan can be reached at jordan.patel@atlas.example or 415-555-0198.

Regards,
Maya Chen`,
  },
  {
    id: "event-follow-up",
    sourceLabel: "Conference intro",
    subject: "Intro after the Stellar Builder Breakfast",
    from: "Priya Shah <priya@northstar.example>",
    body: `Best,
Priya Shah
Northstar Labs
priya@northstar.example
(212) 555-0144`,
  },
];

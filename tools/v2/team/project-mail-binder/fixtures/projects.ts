import type {
  BinderProject,
  BinderMail,
  BinderState,
  BinderStateEmpty,
  BinderStateLoading,
  BinderStateError,
  BinderStateSuccess,
} from "../types";

// ---------------------------------------------------------------------------
// Seed projects
// ---------------------------------------------------------------------------

export const seedProjects: BinderProject[] = [
  {
    id: "proj-onboarding",
    name: "Client Onboarding Q3",
    description:
      "All mail related to the Q3 client onboarding pipeline — contracts, kickoff threads, and follow-ups.",
    color: "blue",
    mailCount: 12,
    createdAt: "2026-05-01T09:00:00.000Z",
    updatedAt: "2026-06-18T14:30:00.000Z",
  },
  {
    id: "proj-compliance",
    name: "Compliance Audit 2026",
    description:
      "Regulatory correspondence, audit requests, and internal review threads for the annual compliance audit.",
    color: "purple",
    mailCount: 7,
    createdAt: "2026-04-15T11:00:00.000Z",
    updatedAt: "2026-06-12T08:45:00.000Z",
  },
  {
    id: "proj-product-launch",
    name: "Product Launch — Horizon",
    description:
      "Cross-team coordination for the Horizon product launch, including marketing, engineering, and partner comms.",
    color: "green",
    mailCount: 23,
    createdAt: "2026-03-20T16:00:00.000Z",
    updatedAt: "2026-06-19T17:15:00.000Z",
  },
  {
    id: "proj-vendor-renewal",
    name: "Vendor Renewal Negotiations",
    description:
      "Contract renewal discussions with key vendors — pricing, SLA changes, and legal review.",
    color: "amber",
    mailCount: 5,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-15T12:00:00.000Z",
  },
];

// ---------------------------------------------------------------------------
// Seed mails
// ---------------------------------------------------------------------------

export const seedMails: BinderMail[] = [
  {
    id: "mail-001",
    projectId: "proj-onboarding",
    subject: "Welcome to the onboarding process",
    sender: "alice@acme.corp",
    date: "2026-05-02T10:15:00.000Z",
    snippet:
      "Hi team, we're kicking off the Q3 onboarding cycle. Please review the attached checklist…",
  },
  {
    id: "mail-002",
    projectId: "proj-onboarding",
    subject: "Re: Contract terms for Initech",
    sender: "bob@legal.co",
    date: "2026-05-10T14:00:00.000Z",
    snippet: "The revised terms are attached. Key change: indemnity clause moved to section 4.2…",
  },
  {
    id: "mail-003",
    projectId: "proj-onboarding",
    subject: "Kickoff meeting notes — Globex",
    sender: "carol@globex.io",
    date: "2026-06-01T09:30:00.000Z",
    snippet:
      "Thanks for a productive kickoff! Action items: 1) provision sandbox, 2) schedule training…",
  },
  {
    id: "mail-004",
    projectId: "proj-compliance",
    subject: "Document request — SOC 2 evidence",
    sender: "auditor@kpmg.example",
    date: "2026-04-20T08:00:00.000Z",
    snippet:
      "Please provide access logs and change management records for the period Jan–Mar 2026…",
  },
  {
    id: "mail-005",
    projectId: "proj-compliance",
    subject: "Internal review: access control policy",
    sender: "dave@internal.team",
    date: "2026-05-15T11:45:00.000Z",
    snippet:
      "I've flagged two gaps in the access control policy. See the attached redline for details…",
  },
  {
    id: "mail-006",
    projectId: "proj-product-launch",
    subject: "Horizon launch timeline v3",
    sender: "pm@horizon.dev",
    date: "2026-04-01T16:00:00.000Z",
    snippet:
      "Updated timeline attached. We've moved the beta date to June 15 to accommodate the new auth flow…",
  },
  {
    id: "mail-007",
    projectId: "proj-product-launch",
    subject: "Press kit assets — final review",
    sender: "marketing@acme.corp",
    date: "2026-06-10T13:00:00.000Z",
    snippet:
      "All press kit assets are uploaded to the shared drive. Please review logos and screenshots…",
  },
  {
    id: "mail-008",
    projectId: "proj-vendor-renewal",
    subject: "Renewal proposal — CloudHost Inc",
    sender: "sales@cloudhost.example",
    date: "2026-06-05T09:00:00.000Z",
    snippet:
      "Attached is our renewal proposal with updated pricing for the Enterprise tier. Key changes…",
  },
];

// ---------------------------------------------------------------------------
// State builders — return fresh objects each call
// ---------------------------------------------------------------------------

export function emptyState(): BinderStateEmpty {
  return { status: "empty" };
}

export function loadingState(): BinderStateLoading {
  return { status: "loading" };
}

export function errorState(
  message = "Failed to load project binders. Please try again.",
): BinderStateError {
  return { status: "error", message };
}

export function successState(): BinderStateSuccess {
  return {
    status: "success",
    projects: seedProjects.map((p) => ({ ...p })),
    mails: seedMails.map((m) => ({ ...m })),
  };
}

/** Convenience: get a specific state by name */
export function stateByName(name: "empty" | "loading" | "error" | "success"): BinderState {
  switch (name) {
    case "empty":
      return emptyState();
    case "loading":
      return loadingState();
    case "error":
      return errorState();
    case "success":
      return successState();
  }
}

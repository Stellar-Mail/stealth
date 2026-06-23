import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleDashed, Clock, ExternalLink, Map, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ModuleState = "complete" | "in-progress" | "planned";
type ActionKind = "demo" | "external";

interface ModuleAction {
  label: string;
  kind: ActionKind;
  action?: string;
  href?: string;
}

interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  state: ModuleState;
  evidence: string[];
  primaryAction: ModuleAction;
  supportingLinks: ModuleAction[];
  disclaimer?: string;
}

const repoBase = "https://github.com/stealthmail/stealth/blob/main";
const issueSearchBase =
  "https://github.com/stealthmail/stealth/issues?q=is%3Aopen+is%3Aissue+repo%3Astealthmail%2Fstealth+";

const modules: ModuleInfo[] = [
  {
    id: "compose",
    name: "Compose",
    description: "Draft editor, encryption toggles, and delivery scheduling.",
    state: "complete",
    evidence: ["Draft body and subject inputs are live", "Send flow records local messages"],
    primaryAction: { label: "Open compose demo", kind: "demo", action: "compose" },
    supportingLinks: [
      {
        label: "Compose notes",
        kind: "external",
        href: `${repoBase}/src/features/compose/README.md`,
      },
    ],
  },
  {
    id: "identity",
    name: "Identity",
    description: "Federation lookup, account identity, and sender trust state.",
    state: "planned",
    evidence: [
      "Architecture notes exist for trust boundaries",
      "A production verifier is not wired yet",
    ],
    primaryAction: {
      label: "Read architecture notes",
      kind: "external",
      href: `${repoBase}/docs/architecture/README.md`,
    },
    supportingLinks: [
      {
        label: "Track identity issues",
        kind: "external",
        href: `${issueSearchBase}identity`,
      },
    ],
    disclaimer: "Proof verification is still mocked in the prototype.",
  },
  {
    id: "ledger",
    name: "Ledger",
    description: "Postage economics, escrow, refunds, and dispute handling.",
    state: "planned",
    evidence: [
      "Protocol notes cover postage and settlement",
      "Production fund flows remain roadmap work",
    ],
    primaryAction: {
      label: "Read protocol notes",
      kind: "external",
      href: `${repoBase}/docs/protocol/README.md`,
    },
    supportingLinks: [
      {
        label: "Track ledger issues",
        kind: "external",
        href: `${issueSearchBase}ledger`,
      },
    ],
    disclaimer: "Not ready for production funds.",
  },
  {
    id: "mail",
    name: "Mail",
    description: "Mailbox state, folder behavior, thread views, and search workflows.",
    state: "complete",
    evidence: [
      "Inbox, archive, and spam flows are wired",
      "Read state and selection persist locally",
    ],
    primaryAction: { label: "Open inbox demo", kind: "demo", action: "mail" },
    supportingLinks: [
      {
        label: "Mail notes",
        kind: "external",
        href: `${repoBase}/src/features/mail/README.md`,
      },
    ],
  },
  {
    id: "settings",
    name: "Settings",
    description: "Mailbox policies, account preferences, and network settings.",
    state: "complete",
    evidence: [
      "Settings modal is wired to local preferences",
      "Onboarding updates the same defaults",
    ],
    primaryAction: { label: "Open settings", kind: "demo", action: "settings" },
    supportingLinks: [
      {
        label: "Settings notes",
        kind: "external",
        href: `${repoBase}/src/features/settings/README.md`,
      },
    ],
  },
  {
    id: "calendar",
    name: "Calendar",
    description: "Mail-to-event workspace, RSVP state, and persistent calendars.",
    state: "in-progress",
    evidence: ["Event creation and RSVP state exist", "Mail reader can launch the workspace"],
    primaryAction: { label: "Open calendar workspace", kind: "demo", action: "calendar" },
    supportingLinks: [
      {
        label: "Calendar notes",
        kind: "external",
        href: `${repoBase}/src/features/calendar/README.md`,
      },
    ],
  },
  {
    id: "api",
    name: "API",
    description: "Versioned endpoints for policy, postage, and receipts.",
    state: "in-progress",
    evidence: [
      "Health, policy, postage, and receipts routes are implemented",
      "OpenAPI is generated for the worker",
    ],
    primaryAction: {
      label: "Read API docs",
      kind: "external",
      href: `${repoBase}/docs/api/README.md`,
    },
    supportingLinks: [
      {
        label: "Track API issues",
        kind: "external",
        href: `${issueSearchBase}api`,
      },
    ],
  },
  {
    id: "contracts",
    name: "Contracts",
    description: "Soroban policies, postage, and receipt state transitions.",
    state: "in-progress",
    evidence: [
      "Policy, postage, and receipt crates are present",
      "Tests cover the first contract transitions",
    ],
    primaryAction: {
      label: "Review policy contract",
      kind: "external",
      href: `${repoBase}/contracts/soroban/policies/README.md`,
    },
    supportingLinks: [
      {
        label: "Postage contract",
        kind: "external",
        href: `${repoBase}/contracts/soroban/postage/README.md`,
      },
      {
        label: "Receipt contract",
        kind: "external",
        href: `${repoBase}/contracts/soroban/receipts/README.md`,
      },
    ],
    disclaimer: "Not audited. Use testnet only.",
  },
];

const stateConfig = {
  complete: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
    label: "Complete",
    dot: "bg-emerald-400",
  },
  "in-progress": {
    icon: CircleDashed,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
    label: "In Progress",
    dot: "bg-amber-400",
  },
  planned: {
    icon: Clock,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
    label: "Coming Soon",
    dot: "bg-blue-400",
  },
} as const;

const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 30, staggerChildren: 0.06 },
  },
  exit: { opacity: 0, scale: 0.96, y: 8 },
};

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

function openExternal(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

function ActionButton({
  action,
  onNavigate,
  onClose,
  secondary,
}: {
  action: ModuleAction;
  onNavigate?: (action: string) => void;
  onClose: () => void;
  secondary?: boolean;
}) {
  const baseClass = cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
    secondary
      ? "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground"
      : "border-white/10 bg-white/[0.08] text-foreground hover:border-white/20 hover:bg-white/[0.12]",
  );

  if (action.kind === "demo") {
    return (
      <button
        type="button"
        onClick={() => {
          if (action.action) {
            onNavigate?.(action.action);
          }
          onClose();
        }}
        className={baseClass}
      >
        {action.label}
        <ExternalLink className="h-3 w-3" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (action.href) {
          openExternal(action.href);
        }
      }}
      className={baseClass}
    >
      {action.label}
      <ExternalLink className="h-3 w-3" />
    </button>
  );
}

export function RoadmapModal({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate?: (action: string) => void;
}) {
  const counts = modules.reduce(
    (acc, mod) => {
      acc[mod.state] += 1;
      return acc;
    },
    { complete: 0, "in-progress": 0, planned: 0 } as Record<ModuleState, number>,
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="glass-strong fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl"
          >
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                    <Map className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Product Roadmap</h2>
                    <p className="text-xs text-muted-foreground">
                      Honest module status for users, contributors, and reviewers
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span>Complete</span>
                    <span className="font-medium text-foreground">{counts.complete}/8</span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span>In progress</span>
                    <span className="font-medium text-foreground">{counts["in-progress"]}/8</span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span>Coming soon</span>
                    <span className="font-medium text-foreground">{counts.planned}/8</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                Status reflects shipped UI, active work, and roadmap items. It does not imply
                production readiness.
              </div>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {modules.map((mod) => {
                  const StateIcon = stateConfig[mod.state].icon;
                  return (
                    <motion.article
                      key={mod.id}
                      variants={cardVariants}
                      whileHover={{ y: -2 }}
                      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-medium text-foreground">{mod.name}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{mod.description}</p>
                        </div>
                        <div
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            stateConfig[mod.state].bg,
                            stateConfig[mod.state].color,
                            stateConfig[mod.state].border,
                          )}
                        >
                          <StateIcon className="h-3 w-3" />
                          {stateConfig[mod.state].label}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {mod.evidence.map((item) => (
                          <div
                            key={item}
                            className="flex items-start gap-2 rounded-lg border border-white/5 bg-black/10 px-2.5 py-2 text-[11px] text-muted-foreground"
                          >
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>

                      {mod.disclaimer && (
                        <div className="mt-3 flex items-start gap-1.5 rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
                          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>{mod.disclaimer}</span>
                        </div>
                      )}

                      <div className="mt-4 border-t border-white/5 pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <ActionButton
                            action={mod.primaryAction}
                            onNavigate={onNavigate}
                            onClose={onClose}
                          />
                          {mod.supportingLinks.map((link) => (
                            <ActionButton
                              key={link.label}
                              action={link}
                              onNavigate={onNavigate}
                              onClose={onClose}
                              secondary
                            />
                          ))}
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/[0.01] px-5 py-3">
              <p className="text-center text-[11px] text-muted-foreground">
                Stealth is pre-alpha. Complete modules are usable in the prototype, while security
                and finance modules remain intentionally guarded and reviewable.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

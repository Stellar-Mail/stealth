# BETA-098 — Usability & Accessibility Acceptance

Issue **#2005** · Workflow 4 — Security, Operations & Beta Launch

## Definition of done checklist

| Requirement                                 | Status | Evidence                                            |
| ------------------------------------------- | ------ | --------------------------------------------------- |
| First-time user journeys (desktop + mobile) | Done   | `acceptance-journeys.spec.ts`                       |
| Manual facilitator scripts                  | Done   | `usability-session-scripts.md`                      |
| Metrics targets and journey catalog         | Done   | `tests/fixtures/beta-acceptance-metrics.json`       |
| Privacy-safe beta feedback capture          | Done   | `src/features/feedback/`                            |
| Informed consent enforcement                | Done   | `tests/unit/feedback/beta-feedback.test.ts`         |
| Redacted session evidence                   | Done   | `run-report.ts` → `run-report.json`                 |
| Operator repeatable command                 | Done   | `bun run beta-acceptance:session`                   |
| CI gate                                     | Done   | `beta-acceptance` job in `.github/workflows/ci.yml` |
| Product protocol doc                        | Done   | `docs/product/beta-acceptance/README.md`            |

## Journey coverage

| Journey              | Automated                                                     | Manual script      |
| -------------------- | ------------------------------------------------------------- | ------------------ |
| Onboarding / mailbox | `acceptance-journeys.spec.ts`                                 | Desktop #1         |
| Address sharing      | `acceptance-journeys.spec.ts`                                 | Desktop #1         |
| Compose / send       | `acceptance-journeys.spec.ts`                                 | Desktop #2         |
| Requests triage      | `acceptance-journeys.spec.ts`                                 | Desktop #3         |
| Proof inspection     | `acceptance-journeys.spec.ts`                                 | Desktop #4         |
| Recovery / sign-in   | `acceptance-journeys.spec.ts` (desktop + mobile)              | Desktop #5, Mobile |
| Beta feedback        | `acceptance-journeys.spec.ts` + `acceptance-evidence.test.ts` | Desktop #6, Mobile |

## Run commands

```bash
# Automated acceptance (same as CI)
bun run test:beta:acceptance

# Operator session + gate evidence
bun run beta-acceptance:session

# Playwright journeys only
bun x playwright test tests/e2e/beta-acceptance/acceptance-journeys.spec.ts
```

## CI

The `beta-acceptance` job runs unit evidence tests, Playwright journeys, and writes `gate-result-beta-acceptance.json`.

## Evidence artifacts

| File                                        | Purpose                          |
| ------------------------------------------- | -------------------------------- |
| `tests/e2e/beta-acceptance/run-report.json` | Redacted automated session steps |
| `gate-result-beta-098-acceptance.json`      | Operator regression evidence     |
| `gate-result-beta-acceptance.json`          | CI gate result                   |

## Dependencies

- BETA-073 (#1980) — WCAG keyboard, screen-reader, contrast, motion
- BETA-075 (#1982) — two-user web experience
- BETA-096 (#2003) — in-app beta feedback (client payload builder in `src/features/feedback/`)

## Redaction

All suites use `assertNoSecretsLeaked()`. Feedback notes pass through `redactFeedbackNote()` before persistence.

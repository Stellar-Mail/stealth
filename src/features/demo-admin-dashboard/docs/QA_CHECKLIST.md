# Campaign Demo Data QA Checklist

Use this checklist before merging any PR that adds or modifies demo data under
`src/features/demo-admin-dashboard/`. Every item must be checked by the reviewer.

---

## 1. Data safety

- [ ] All email addresses use `example.com`, `example.org`, or the reserved
      `*.stealth.demo` handle — no real addresses present.
- [ ] No private keys, secrets, tokens, mnemonics, or Stellar account seeds in
      any fixture or constant.
- [ ] No real user names, real organisation names, or PII in any demo record.
- [ ] Fixture values are hardcoded constants — no `Math.random()`, `Date.now()`,
      or other non-deterministic calls.

## 2. Scope isolation

- [ ] All new or changed files live under `src/features/demo-admin-dashboard/`.
- [ ] No files outside that folder were modified (check the diff).
- [ ] No imports from production mail, inbox, calendar, sender-conversion,
      protocol, routing, or app-shell modules were added.
- [ ] If an integration point became necessary, it is documented as a follow-up
      issue rather than implemented here.

## 3. Demo data correctness

- [ ] `adminDashboardPanels` — each panel has a non-empty `id`, `title`,
      `description`, a valid `status` (`"ready" | "needs-review" | "draft"`), and a
      positive integer `demoRecords`.
- [ ] `adminDashboardWidthNotes` — entries cover all three breakpoints (`tablet`,
      `laptop`, `desktop`) with non-overlapping width ranges and consistent
      `sidebarMode` values.
- [ ] `adminDashboardLayoutChecks` — each check references a known breakpoint and
      has a non-empty `expected` description.
- [ ] Draft fixtures (if present) use the `Draft` type from `types/draft.ts` and
      contain at least `id`, `subject`, `body`, and `recipients`.

## 4. Test coverage

- [ ] At least one unit test exercises the new or changed data (fixture shape,
      helper output, or component render).
- [ ] `npx vitest run src/features/demo-admin-dashboard` exits green locally.
- [ ] No test uses `any` casts to bypass type checks on fixture data.
- [ ] Campaign copy rules and internal note templates are documented in
      `docs/CAMPAIGN_COPY_RULES.md`.

## 5. Types

- [ ] No new `any` types introduced in `types.ts` or `types/draft.ts`.
- [ ] Any new exported type is documented with a JSDoc comment.
- [ ] TypeScript compiles without errors (`tsc --noEmit`).

## 6. Reviewer steps

1. Pull the branch and run:
   ```bash
   npx vitest run src/features/demo-admin-dashboard
   ```
2. Grep for real-looking addresses:
   ```bash
   grep -r "@" src/features/demo-admin-dashboard/fixtures | grep -v "example\.\|stealth\.demo"
   ```
   — expect no output.
3. Grep for non-determinism:
   ```bash
   grep -r "Math\.random\|Date\.now\|new Date()" src/features/demo-admin-dashboard/fixtures
   ```
   — expect no output.
4. Confirm the diff contains no files outside `src/features/demo-admin-dashboard/`.
5. Check the `demoRecords` counts are plausible for the described scenario (not
   0, not absurdly large).

---

_This checklist is Campaign issue 46 of 50 for the Demo Admin Dashboard initiative._

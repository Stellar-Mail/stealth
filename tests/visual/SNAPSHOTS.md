# Visual Snapshot Guide

> **Audience:** anyone changing UI components, styles, or layout.

Visual tests in `tests/visual/` use [Playwright](https://playwright.dev) to take screenshots of real rendered views and compare them against stored baseline images. A diff signals that something visible changed. That may be intentional or a regression.

---

## Structure

```
tests/visual/
  fixtures.ts                          # Deterministic sample data (no real PII)
  mail-list.screenshot.ts              # Mail list, folder views, sidebar
  mail-reader.screenshot.ts            # Email reader, all protocol states
  compose-calendar-settings.screenshot.ts  # Compose, calendar, settings, feedback
  __snapshots__/                       # Committed baseline images (generated)
  __results__/                         # Failures and diffs (gitignored)

playwright.config.ts                   # Three projects: desktop / tablet / mobile
```

Baseline images are committed to the repository so CI can detect regressions. The `__results__/` directory holds only failure artifacts and is gitignored.

---

## Running the tests

You need a running dev server first. The playwright config starts one automatically, but you can start it yourself:

```bash
npm run dev          # start the dev server (localhost:8080)
```

Then, in a separate terminal:

```bash
npm run test:screenshots
```

To run a single file:

```bash
npx playwright test tests/visual/mail-list.screenshot.ts
```

To run a single project (viewport):

```bash
npx playwright test --project=desktop
npx playwright test --project=tablet
npx playwright test --project=mobile
```

---

## Reading a failure

When a test fails Playwright writes three files to `tests/visual/__results__/`:

| File | Meaning |
|------|---------|
| `*-actual.png`   | What the browser rendered today |
| `*-expected.png` | The committed baseline |
| `*-diff.png`     | Pixel-level difference, highlighted in red |

Open them with any image viewer. The diff shows exactly which pixels changed.

---

## Updating baselines intentionally

Before updating, confirm the visual change is **intentional and reviewed**. Updating snapshots without review makes it impossible to detect future regressions in the same area.

**Step 1 — verify the change in the browser**

```bash
npm run dev
# Open http://localhost:8080 and inspect the affected views manually.
```

**Step 2 — regenerate the baselines**

```bash
npm run test:screenshots:update
```

This overwrites only the snapshots that have diffs. Unchanged snapshots are left intact.

**Step 3 — review the diff before committing**

```bash
git diff --stat tests/visual/__snapshots__
```

Open each changed `.png` and confirm it matches the intended new appearance. Pay attention to:

- Text layout and truncation
- Badge and label visibility (proof states, OTP cards, encrypted indicators)
- Protocol-specific controls (approve/block, postage display, receipt status)
- Responsive layout at tablet and mobile widths

**Step 4 — commit with a clear note**

```
git add tests/visual/__snapshots__
git commit -m "snapshots: update <component name> after <reason>"
```

The commit message body should describe **what changed and why**. Example:

```
snapshots: update inbox list after unread indicator redesign

The unread dot moved from top-right of avatar to left gutter.
All three viewports updated. Verified on desktop, tablet, and mobile.
```

---

## Adding new screenshot scenarios

1. Choose or create the right test file for the surface (mail-list, mail-reader, compose-calendar-settings).
2. Write the test using the `test()` function from `@playwright/test`.
3. Call `toHaveScreenshot("descriptive-name.png")` — keep names lowercase with hyphens.
4. Run `npm run test:screenshots:update` once to generate the initial baseline.
5. Commit both the test file and the new snapshot images together.

Example:

```ts
import { expect, test } from "@playwright/test";

test("mail-list — new protocol state", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("section.mail-list-atmosphere");
  await page.locator("button:has-text('Verified')").first().click();
  await expect(page).toHaveScreenshot("mail-list-new-state.png", { fullPage: false });
});
```

---

## Fixture data

All sample data lives in `tests/visual/fixtures.ts`. It is the single source of truth for test content.

Rules enforced by the file:

- **No real personal data.** Names, domains, and Stellar addresses are synthetic.
- **Type-safe.** The `satisfies` operator means TypeScript will error if a field goes out of sync with the source types in `src/`.
- **Deterministic.** Objects are `Object.freeze()`d to prevent test-order effects.
- **Stable IDs.** Fixture IDs use a `fix-` prefix so they cannot collide with application-generated IDs.

When adding new fixture fields, update `fixtures.ts` rather than duplicating values in test files.

---

## Tolerance and animation

The config sets `maxDiffPixelRatio: 0.02` (2 %). This accepts minor sub-pixel rendering differences between machines while still catching meaningful layout shifts.

Animations are disabled globally (`animations: "disabled"`, `reducedMotion: "reduce"`). If a new component uses CSS animations that produce flicker, check that the `prefers-reduced-motion` media query disables them.

---

## CI

On every pull request the CI workflow (`.github/workflows/ci.yml`) runs:

```
npm run test:screenshots
```

against the committed baselines. A failure means either:

- a visual regression was introduced and needs to be fixed, or
- a planned change needs baselines updated (run `test:screenshots:update` and push the new images).

Baselines should only be updated in a dedicated commit, not mixed with feature changes.

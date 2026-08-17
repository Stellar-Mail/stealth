## Email Tone Rewriter — Architecture Contract & Expanded Codebase

**Closes #349**

This PR adds the architecture contract and expands the codebase for the Email Tone Rewriter as a self-contained V1 individual mini-product.

### Summary

Adds `ARCHITECTURE.md` as the central architecture contract and 12 new files (~2,300 lines) across hooks, services, and tests — all without modifying any existing code.

### What's included

**Architecture contract** (`ARCHITECTURE.md`):

- Purpose & design decisions — pure, local, rule-based, deterministic, isolated
- Complete folder structure — annotated tree of all files in the tool
- Module responsibilities — types, services, guards, hooks, components, tests, docs
- One-way dependency flow — Components → Hooks → Services → Types (no circular deps)
- Data flow diagram — from draft input through guards → engine → result
- Cross-references to existing companion docs
- What contributors may change (8 allowances) and may NOT change (7 prohibitions)
- Security, performance, testing strategy, and future integration path

**New hooks** (`hooks/`):

- `useEmailToneRewriter` — Full rewrite lifecycle (draft, state, rewrite, reset, dirty tracking)
- `useRewriterHistory` — In-memory session history with push/remove/clear/label/export
- `useBatchRewriter` — Sequential batch processing with cancel support
- `useTonePresets` — Built-in + custom preset management with best-match logic
- `useRewriteDiff` — Word-level diff comparison with statistics

**New services** (`services/`):

- `diff.ts` — LCS-based word-level diff engine (tokenize, compute, render, change rate)
- `batch.ts` — Batch processing (sequential, parallel, validation, dedup, sorting, analysis)
- `presets.ts` — 10 built-in presets with tags, grouping, context matching, smart suggestion

**New tests** (`tests/`):

- `diff.test.ts` — 50+ tests covering tokenization, LCS, backtracking, diff, render, change rate
- `batch.test.ts` — 40+ tests covering batch processing, validation, dedup, sorting, analysis
- `presets.test.ts` — 30+ tests covering preset lookup, filtering, grouping, suggestion

### Acceptance criteria met

- ✅ Clear folder-local architecture plan
- ✅ No modifications to main app shell, routing, inbox architecture, wallet core, Stellar core, or design system
- ✅ Specs explain what future contributors may and may not change
- ✅ Files changed are limited to `tools/v1/individual/email-tone-rewriter/`
- ✅ Contribution is reviewable as a self-contained mini-product change
- ✅ No existing files were modified — all additions are new files

### Labels

- Architecture
- GrantFox OSS
- Maybe Rewarded
- Official Campaign
- Tooling Ecosystem
- V1 Launch Tool
- Individual Tool

### Files changed

```
tools/v1/individual/email-tone-rewriter/ARCHITECTURE.md          (+237 lines, new)
tools/v1/individual/email-tone-rewriter/hooks/index.ts           (+12 lines, new)
tools/v1/individual/email-tone-rewriter/hooks/useEmailToneRewriter.ts  (+120 lines, new)
tools/v1/individual/email-tone-rewriter/hooks/useRewriterHistory.ts   (+100 lines, new)
tools/v1/individual/email-tone-rewriter/hooks/useBatchRewriter.ts     (+120 lines, new)
tools/v1/individual/email-tone-rewriter/hooks/useTonePresets.ts       (+170 lines, new)
tools/v1/individual/email-tone-rewriter/hooks/useRewriteDiff.ts       (+110 lines, new)
tools/v1/individual/email-tone-rewriter/services/diff.ts              (+230 lines, new)
tools/v1/individual/email-tone-rewriter/services/batch.ts             (+280 lines, new)
tools/v1/individual/email-tone-rewriter/services/presets.ts           (+280 lines, new)
tools/v1/individual/email-tone-rewriter/tests/diff.test.ts            (+260 lines, new)
tools/v1/individual/email-tone-rewriter/tests/batch.test.ts           (+260 lines, new)
tools/v1/individual/email-tone-rewriter/tests/presets.test.ts         (+180 lines, new)
```

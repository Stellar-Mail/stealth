# Campaign Quick Fixes

Provides a safe, deterministic quick-fix registry for common data quality issues in demo campaign data (e.g., missing tags, duplicate names, invalid dates).

This feature operates entirely within the isolated `src/features/demo-admin-dashboard/` workspace and acts strictly on local memory datasets to guarantee public repository safety.

## Architecture

- **Pure Functions:** Each quick fix is implemented as a pure function mapping a raw input `CampaignRecord` to a corrected one.
- **Reversible Actions:** The core runner `applyQuickFixes` outputs a `QuickFixResult` that contains both the `original` record and the `fixed` record. This guarantees that UI implementations can present a "Preview" step and support immediate "Undo" actions.
- **Deterministic Behavior:** Bad dates map to safe `2023` constants instead of using `Date.now()`, fulfilling the safety requirements for the campaign demo data.

## Implemented Fixes

1. **`fixMissingTags`**: Automatically assigns the label `"untagged"` to records holding empty or undefined tags arrays.
2. **`fixDuplicateNames`**: Processes records in batch, identifying duplicate names and appending sequential numbers (e.g., `(1)`, `(2)`) to ensure unique identifiers.
3. **`fixInvalidDates`**: Scrubs out malformed ISO strings replacing them with static fallbacks. It also enforces chronological safety by clamping the `endDate` to the `startDate` if they are provided in reverse order.

## Usage Example

```typescript
import { applyQuickFixes } from "./campaignQuickFixes";

const rawCampaigns = [
  { id: "1", name: "Welcome", tags: [] },
  { id: "2", name: "Welcome", tags: ["onboarding"] },
];

const results = applyQuickFixes(rawCampaigns);

// results[0].fixed => { name: 'Welcome', tags: ['untagged'] }
// results[1].fixed => { name: 'Welcome (1)', tags: ['onboarding'] }
// results[0].appliedFixes => ['fixDuplicateNames', 'fixMissingTags']
```

## Future Integrations

Wiring this logic into a clickable "Run Auto-Fix" button in the Dashboard's dataset validation panel remains out-of-scope for this standalone issue. When ready, the UI component should map `results[i].original` back to the table when a user issues an "Undo" command.

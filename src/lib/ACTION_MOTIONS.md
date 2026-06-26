# Action Motion System

Consistent, subtle motion patterns for archive, star, snooze, approve, block, refund, and copy-proof actions.

## Design Principles

- **Avoid novelty** — interactions reinforce state and confidence, not entertain
- **Immediate feedback** — visual response before server confirmation
- **Visible rollback** — failed optimistic actions animate back to previous state
- **Reduced motion** — all presets respect `prefers-reduced-motion`
- **Haptic-like timing** — spring physics at 80–500ms feel tactile without being distracting

## File Structure

```
src/
├── lib/
│   ├── action-motions.ts       # Motion presets (icon swaps, row removal, rollback)
│   └── ACTION_MOTIONS.md       # This file
├── hooks/
│   └── useOptimisticAction.ts  # Optimistic update hook with rollback
└── components/
    └── mail/
        └── ActionIcon.tsx      # Animated icon wrapper component
```

## Quick Start

### 1. Animated Icon Button

```tsx
import { ActionIcon } from "@/components/mail/ActionIcon";
import { Star } from "lucide-react";

<ActionIcon
  type="star"
  active={email.starred}
  onClick={() => toggleStar(email.id)}
>
  <Star className="h-4 w-4" />
</ActionIcon>
```

### 2. Optimistic Action with Rollback

```tsx
import { useOptimisticAction } from "@/hooks/useOptimisticAction";

const archiveAction = useOptimisticAction({
  onAction: (id) => updateEmail(id, { folder: "archive" }),
  onRollback: (id, prev) => updateEmail(id, prev),
  onError: (msg) => showToast(msg, { tone: "danger" }),
});

// On click:
archiveAction.execute(email.id, () => ({ ...email }));

// On server confirm:
archiveAction.confirm();

// On server error:
archiveAction.revert(email.id, "Archive failed");
```

### 3. Row Removal Animation

Wrap list items with `AnimatePresence` and use `rowCollapse`:

```tsx
<AnimatePresence>
  {emails.map((email) => (
    <motion.li
      key={email.id}
      {...actionMotions.rowCollapse()}
    >
      {/* email row content */}
    </motion.li>
  ))}
</AnimatePresence>
```

## Motion Tokens

### Duration Tokens (`actionDurations`)

| Token     | Value (normal) | Value (reduced) | Use Case                  |
|-----------|----------------|-----------------|---------------------------|
| `instant` | 80ms           | 0               | Icon swap, color shift    |
| `quick`   | 200ms          | 0               | Confirmation pulse        |
| `standard`| 350ms          | 0               | Standard action feedback  |
| `removal` | 400ms          | 0               | Row collapse / removal    |
| `rollback`| 500ms          | 0               | Failed action revert      |

### Easing Tokens (`actionEasings`)

| Token    | Cubic Bezier                    | Feel                    |
|----------|---------------------------------|-------------------------|
| `snappy` | `[0.2, 0.8, 0.2, 1]`           | Responsive, crisp       |
| `smooth` | `[0.4, 0, 0.2, 1]`             | Decelerating, natural   |
| `bouncy` | `[0.34, 1.56, 0.64, 1]`        | Playful confirmation    |

## Action Types

| Action       | Icon Animation              | Tone      | Rollback Style |
|-------------|-----------------------------|-----------|----------------|
| `archive`   | Slide left + fade           | default   | Standard shake |
| `star`      | Scale pulse + rotate        | default   | Standard shake |
| `unstar`    | Scale down                  | default   | Standard shake |
| `snooze`    | Clock hand rotation         | default   | Standard shake |
| `approve`   | Checkmark scale-in + bounce | success   | Standard shake |
| `block`     | Shake + red tint            | danger    | Danger shake   |
| `copy-proof`| Flash + scale               | default   | Standard shake |
| `refund`    | Icon swap                   | danger    | Danger shake   |
| `generic`   | Scale + rotate              | default   | Standard shake |

## Accessibility

- All animations respect `prefers-reduced-motion` system setting
- Reduced motion reduces all durations to 0 and disables spring physics
- Rollback animations fall back to opacity flash when reduced motion is active
- `aria-pressed` is set on toggle actions (star, approve, block)
- Focus states are preserved — animations don't trap keyboard navigation

## Usage in Components

### EmailView (reader toolbar)

The reader toolbar in `EmailView.tsx` uses `ActionIcon` for:
- **Snooze** — `type="snooze"` with clock rotation
- **Archive** — `type="archive"` with slide-left
- **Trash** — `type="generic"` with `tone="danger"`
- **Star** — `type="star"` / `type="unstar"` with scale pulse

### EmailList (row removal)

Wrap email list items in `AnimatePresence` and apply `rowCollapse()` for:
- Archive — row slides out and collapses
- Trash — row collapses with fade
- Approve/Block — row collapses after sender conversion

### BulkActionBar (bulk operations)

The `ActionButton` component provides consistent styling for:
- **Approve** — `tone="success"` with green border
- **Block** — `tone="danger"` with red border
- **Archive** — default tone

### ProvenancePanel (copy proof)

The "Copy proof" button uses `ActionIcon` with `type="copy-proof"` for a brief flash + scale on clipboard action.
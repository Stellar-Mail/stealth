# Admin Confirmation Dialog

A reusable confirmation dialog for destructive demo-data actions (issue #33). All copy is static, deterministic, and safe for public review.

## Component

- `AdminConfirmDialog` — A Radix-based alert dialog for confirming high-risk actions.

## Props

- `isOpen` (boolean) — Controls dialog visibility.
- `onOpenChange` (function) — Callback when visibility changes.
- `onConfirm` (function) — Callback when action is confirmed.
- `title` (string) — Accessible heading for the dialog.
- `description` (string) — Detailed explanation of the action's impact.
- `confirmText` (string) — Label for the primary action button.
- `cancelText` (string) — Label for the cancel button.
- `variant` ("destructive" | "warning" | "default") — The visual style of the action button.
- `isLoading` (boolean) — Disables buttons and shows a loading state during async operations.

## Variants

- **Destructive** (`destructive`) — Default. Used for actions that cannot be undone (e.g., "Delete Campaign"). Uses `bg-destructive`.
- **Warning** (`warning`) — Used for actions that have significant but recoverable impact (e.g., "Reset Demo Data"). Uses yellow branding.
- **Default** (`default`) — Used for standard confirmations. Uses primary action styling.

## Examples

### Delete Confirmation
```tsx
<AdminConfirmDialog
  isOpen={isDeleting}
  onOpenChange={setIsDeleting}
  onConfirm={handleDelete}
  title="Delete Demo Campaign?"
  description="This will permanently remove the campaign and all its associated messages. This action cannot be undone."
  confirmText="Delete Campaign"
  variant="destructive"
/>
```

### Reset Confirmation
```tsx
<AdminConfirmDialog
  isOpen={isResetting}
  onOpenChange={setIsResetting}
  onConfirm={handleReset}
  title="Reset Demo Data?"
  description="This will revert all messages and campaigns to their original state. You will lose any unsaved changes."
  confirmText="Reset Data"
  variant="warning"
/>
```

## Scope

All code lives under `src/features/demo-admin-dashboard/`. These controls are isolated from production mail flows.

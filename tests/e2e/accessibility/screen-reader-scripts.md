# Manual screen-reader scripts — BETA-073 (Issue #1980)

These scripts are the documented manual NVDA / VoiceOver pass over the live
mailbox. The automated suite in `accessibility.spec.ts` covers axe + keyboard
automation; this document captures the qualitative screen-reader checks and
what a correct result sounds like. Screenshots for the PR evidence set are
taken from the states described below.

Environment: the `/demo` route (`STEALTH_DEMO_BYPASS_FETCH=true` dev build) —
run `npm run dev` and open `http://localhost:5173/demo`.

## 1. Landmarks and page structure

1. NVDA: press `D` until you cycle through landmarks.
   Expected: `banner` (topbar chrome) → `navigation "Mail folders"` (sidebar) →
   `main` (mailbox) → `navigation "Bottom navigation"` → `complementary`
   (email reader columns).
2. Press `H` (headings). Expected order: `Inbox` (level 2) → message rows are
   items, not headings; the reader shows the thread subject as a heading.

## 2. Skip link

1. On load, press `Tab`.
   Expected: "Skip to mailbox" becomes visible and focused.
2. Press `Enter`.
   Expected: focus moves to `main` and the next `Tab` lands on the search box.

## 3. Mailbox navigation

1. `Tab` from the topbar search box through the quick actions (Proofs, Later,
   Files), Filter, Notifications, Import contacts, Help, Proof Inspector,
   Settings, Account menu.
   Expected: each button announces a name; the active folder buttons in the
   sidebar announce `pressed` / `current page` states.
2. Arrow keys are not intercepted in the list (no listbox role); `Tab` moves
   row to row, and each row button includes the sender, subject, and time.
3. `Ctrl+N` opens compose. NVDA announces "New message, dialog".

## 4. Compose dialog

1. After `Ctrl+N`, focus lands in the "To" field.
2. `Tab` once — the recipient policy banner is announced, then the subject
   field ("Subject, edit multiline").
3. `Escape` closes the dialog; focus returns to the Compose button.
4. Send a message with an empty recipient: the inline validation message
   "Please add at least one recipient" is announced (it appears inside an
   `aria-live` region).
5. Send-failure path: with the relay unreachable, the pipeline pane announces
   "Send Pipeline Progress" plus a polite update per stage; on failure an
   `alert` announces the failure detail and a "Retry send" button is focused
   for recovery.

## 5. Filter / Notifications popovers

1. Tab to "Filter", press `Enter`. NVDA announces a dialog named "Filters".
   The first toggle ("Unread only") receives focus.
2. `Escape` closes; focus returns to the Filter button.
3. "Notifications" opens a dialog named "Notifications"; `Escape` restores the
   bell button.

## 6. Account and Help menus

1. Activate "Account menu". NVDA announces "Account, menu". Arrow keys move
   through `menuitem`s (Profile, Switch account, Sign in with password,
   Sign out).

## 7. Requests triage board

1. In the sidebar folders, select "Requests".
   Expected: heading "Request Triage Board" with pending count; card group
   elements name each offer (sender, amount) and the Approve / Block /
   Refund buttons are separately readable.
2. Activate a card's "Details" control. The inspection panel is announced as
   a dialog ("Inspect sender request context") with focus inside; `Escape`
   closes and returns focus.

## 8. Reduced motion

1. Enable "remove animations" in the OS (or emulate `prefers-reduced-motion:
reduce` in DevTools).
2. Open and close compose, the filter popover, and the settings modal.
   Expected: no translation/flash movement; all dialogs still open
   instantaneously and announce normally. The settings transitions and the
   loader spinner stop looping.

## 9. 320 px reflow (magnification)

1. Zoom to 400% (effective 320 px viewport) or resize the window to 320 px.
   Expected: no horizontal scrolling anywhere in the mailbox shell; the
   compose dialog is inset from the edges and its fields remain reachable by
   keyboard; the bottom navigation labels remain visible.

## 10. Focus visibility

1. Tab through the entire mailbox chrome.
   Expected: every stop shows either the default focus outline or the brand
   ring (2px light ring); nothing loses focus indication while typing.

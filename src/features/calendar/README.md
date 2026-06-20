# Calendar Workspace Contributor Handoff

Calendar owns event-specific mail rendering, persistent event state, custom
calendars, and the scheduling workspace. Keep changes focused on the existing
mail-linked calendar experience rather than adding a separate calendar product
or a new event-ingestion architecture.

## Capabilities

- Create, edit, duplicate, and delete events.
- Navigate month and agenda views.
- Toggle calendar visibility and create color-coded calendars.
- RSVP and configure reminders.
- Convert event mail into calendar records without duplicates.
- Open a selected event from the mail reader or Today panel.
- Persist calendar state in local storage for the prototype.

## Local File Map

- `components/CalendarWorkspace.tsx` renders the modal workspace, left calendar
  picker, custom-calendar form, agenda/month event lists, event details panel,
  RSVP/reminder controls, copy/join actions, and event editor.
- `components/EventMailCard.tsx` renders the mail-reader event card, event/month
  toggle, Add to calendar CTA, Open calendar action, reminder selector, RSVP
  buttons, and meeting-link handoff.
- `useCalendar.ts` owns local calendar state, local-storage hydration, visible
  calendar filtering, duplicate prevention for mail-linked events, event CRUD,
  RSVP/reminder updates, and custom-calendar creation.
- `dateUtils.ts` provides the pinned prototype clock, app-today start date, and
  local timezone helper so seeded mail, reminders, and calendar markers agree.
- `data.ts` holds synthetic default calendars, synthetic default events, and
  color tokens used by the workspace.
- `types.ts` defines `MailEvent`, `CalendarEvent`, `CalendarDefinition`,
  `CalendarEventDraft`, and `CalendarResponse`.

## Data Contracts

`MailEvent` is the read-only event context embedded in mail. It may include a
title, date, visible month/day text, time window, location, note, calendar id,
organizer, meeting URL, and a small display-only days array. Treat this as
message-derived context; do not assume it is already a saved calendar record.

`CalendarEvent` is the saved workspace record. It has a stable `id`, normalized
date, start/end times, calendar id, cadence, optional organizer and meeting URL,
optional `sourceEmailId`, RSVP response, and reminder. `sourceEmailId` is the
duplicate-prevention key when adding an event from mail.

`useCalendar` persists a `CalendarSnapshot` to local storage under
`stealth-calendar-v1`. This storage is prototype state, not a synced account
calendar. Update the hook and tests together if the storage key, fallback
defaults, duplicate behavior, or date normalization changes.

`getAppToday` is intentionally pinned for the mock app. Features that need a
"today" marker should use `dateUtils.ts` instead of new `Date()` literals until
the app switches from seeded data to live time.

## User-Facing States

- The workspace opens as a modal and can be closed from the backdrop, close
  button, or Escape when the editor is not open.
- The header exposes Today, previous/next month, agenda/month view, New event,
  and close controls.
- The left rail shows visible calendars, event counts per calendar, color
  swatches, calendar toggles, and a custom calendar form.
- The main panel shows selected-day agenda events or month overview events, plus
  an empty state with Create event when no visible events match.
- The details panel shows selected event metadata, RSVP, reminder, Join, Copy
  details, Duplicate, Delete, and Edit.
- The editor supports create and update flows with required title/date/time
  fields, calendar selection, cadence, location, and notes.
- The mail card shows Upcoming event or Added to calendar, Add to calendar,
  Open calendar, RSVP, reminder, and meeting-link handoff.

## Safety And Privacy Boundaries

All default events and calendars are synthetic demo data. Do not add real
calendar invites, customer names, meeting links, private notes, addresses,
access tokens, payment account details, or live mailbox content to fixtures,
docs, tests, screenshots, or seeded state.

The calendar workspace is local prototype state. It must not silently create
external calendar events, send RSVP replies, email attendees, join meetings,
sync contacts, or write to a server. Any future external calendar or meeting
integration needs explicit user intent, clear status copy, and auditable error
handling.

Meeting URLs and clipboard copy are trust-sensitive. Keep meeting links sourced
from the saved event or mail event only, open them with `noopener,noreferrer`,
and avoid copying private notes beyond the current explicit Copy details action.

Mail-to-event conversion should stay idempotent through `sourceEmailId` so a
reviewer cannot accidentally create duplicate events by clicking Add repeatedly.
Do not remove that guard without replacing it with another visible duplicate
prevention contract.

## QA Checklist

- Confirm Calendar opens, closes, and honors Escape behavior with and without
  the editor open.
- Verify Today, previous/next month, agenda/month view, date selection, and event
  count updates remain consistent with `getAppToday`.
- Toggle calendar visibility and confirm hidden calendars remove their events
  from agenda/month views without deleting them.
- Create, edit, duplicate, and delete an event; verify selection, date/month,
  toast copy, and local state all update.
- Add a mail event twice and confirm the second action returns the existing
  event instead of creating a duplicate.
- Change RSVP and reminder from both the workspace details panel and
  `EventMailCard` when a saved event exists.
- Check Join, Copy details, Open calendar, and Add to calendar actions for
  explicit user intent and no unexpected external side effects.
- Run targeted calendar tests when available, then run typecheck and lint when
  the local dependency install supports the project commands.

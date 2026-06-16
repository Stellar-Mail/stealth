# Trust Badge

A single, canonical sender-trust badge shared across every mail surface so the
same sender state always reads the same way.

## States

verified, allowed, unknown, paid, blocked, bridged, encrypted — each has one
fixed label, color token, icon, and tooltip.

## Parts

- TrustBadge (design-system) — presentational pill. Always renders text (or a
  screen-reader label), never color-only meaning. Tooltip on by default.
- getTrustStates(email) (components/mail/trust-state) — derives the applicable
  states from folder, labels, senderPolicy, and verifiedSender.
- EmailTrustBadges (components/mail) — drop-in renderer for any surface.

## Usage

- List rows / compose chips: render EmailTrustBadges with max=1 for the primary state.
- Reader header / sender cards: render EmailTrustBadges with no max to show all states.

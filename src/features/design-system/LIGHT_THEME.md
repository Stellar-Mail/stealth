# Warm Light Theme

Select **Settings > Appearance > Theme > Light**, then save. The app-wide
preferences provider preserves that choice across the inbox, auth, onboarding,
admin routes and reloads. System mode follows the device theme; dark remains
available.

## Palette

The source of truth is `styles/tokens.css`. Light mode uses pale yellow-tinted
parchment (`#f2f0e4`) rather than pure white, with cream cards (`#f8f6ec`), warm
charcoal text and quiet sand borders. Selected and hovered cards have distinct
warm surfaces without moving or resizing them.

- Use `background`, `card`, `popover`, `secondary` and `muted` for content surfaces.
- Use `foreground` and `muted-foreground` for text; pair `primary` actions with
  `primary-foreground`.
- Use `surface-tint/<opacity>` for subtle highlights and borders that previously
  assumed white-on-dark. Use `surface-recessed/<opacity>` for recessed controls,
  not for modal backdrops.
- Use `status-success`, `status-warning`, `status-danger`, `status-info`,
  `status-special` and `status-neutral` for readable status text. Keep labels and
  icons so status never depends only on color.
- Dialog backdrops may remain black. Sender avatars, media, QR codes and profile
  illustrations keep their original colors; do not invert images to theme them.
- Custom calendar, OTP and glass surfaces must consume the same palette. New
  standalone tools should import the app's theme styles when hosted separately.

`light-palette.test.ts` checks opaque surfaces and AA text contrast across the
normal, selected and hovered palette. `preferences-provider.test.tsx` checks
saved appearance and cross-route sharing. Check actual rendered contrast too:
opacity, translucent layers and decorative backgrounds affect the final result.

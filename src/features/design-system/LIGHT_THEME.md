# Warm Light Theme

Select **Settings > Appearance > Theme > Light**, then save. The app-wide
preferences provider preserves that choice across the inbox, auth, onboarding,
admin routes and reloads. System mode follows the device theme; dark remains
available.

## Palette

The source of truth is `styles/tokens.css`. The base is `#FDF3B7`, the equal
sRGB blend of `#FDEB9E` and `#FDFBCF`, with the blue channel rounded to the
nearest whole value. Butter-yellow plates, warm brown ink, bronze icons and
honey-colored borders form one palette. Selected and hovered cards have
distinct warm surfaces without moving or resizing them.

Glass surfaces retain 38-84% opaque fills, depending on the selected intensity.
Warm ambient gradients remain visible behind the blur; cream rim highlights,
soft reflections and brown-tinted shadows provide depth without white plates
or heavy black shadows. Text and icons inherit the same warm palette on every
route. Uploaded images and sender identicons retain their original colors.

## Navigation

The header, sidebar, search and mobile navigation share the custom postal SVG
family in `components/mail-icons.tsx`. Icons use `currentColor` in both themes;
action labels and tooltips remain unchanged. Compose uses the nib-and-note
glyph instead of the generic pencil. Keep verified checks and sender artwork
separate from navigation icons.

Native and custom scrollbar indicators are hidden app-wide. Overflow remains
scrollable with a wheel, trackpad, touch or keyboard. Shared scroll-area
viewports are keyboard-focusable and retain a visible focus outline.

- Use `background`, `card`, `popover`, `secondary` and `muted` for content surfaces.
- Use `foreground` and `muted-foreground` for text; pair `primary` actions with
  `primary-foreground`.
- Use `icon` for neutral chrome icons. Semantic status icons retain their status
  token, and selected controls use their foreground color.
- Use `surface-tint/<opacity>` for subtle highlights and borders that previously
  assumed white-on-dark. Use `surface-recessed/<opacity>` for recessed controls,
  not for modal backdrops.
- Use `status-success`, `status-warning`, `status-danger`, `status-info`,
  `status-special` and `status-neutral` for readable status text. Keep labels and
  icons so status never depends only on color.
- Use `overlay/<opacity>` for dialog backdrops: black in dark mode, amber in
  light mode, so translucent cream panels do not pick up a muddy gray cast.
  Sender avatars, media, QR codes and profile illustrations keep their original
  colors; do not invert images to theme them.
- Custom calendar, OTP and glass surfaces must consume the same palette. New
  standalone tools should import the app's theme styles when hosted separately.

`light-palette.test.ts` checks the requested blend, translucent glass levels,
warm icon colors and AA text contrast across the normal, selected and hovered
palette. `preferences-provider.test.tsx` checks
saved appearance and cross-route sharing. Check actual rendered contrast too:
opacity, translucent layers and decorative backgrounds affect the final result.

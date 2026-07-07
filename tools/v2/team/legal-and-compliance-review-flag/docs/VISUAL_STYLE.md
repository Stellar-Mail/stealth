# Legal and Compliance Review Flag Visual Style

## Direction

The local UI uses a restrained compliance console style: quiet slate surfaces,
small uppercase section labels, crisp borders, and severity accents that stay
readable during repeated review work.

## Palette

- Slate surfaces for the neutral work area.
- Cyan accents for selection and navigation context.
- Amber and red accents for high-risk legal review states.
- Emerald accents for approved or healthy states.

The shared design system is not changed. All styling stays in local component
class names so a future integration can adapt tokens separately.

## Layout

- A two-column desktop layout separates the queue from the selected flag.
- The queue remains a single interactive list, not nested cards.
- Detail metadata uses compact definition-list panels for quick scanning.
- Mobile and narrow layouts collapse naturally into a single column.

## Interaction Treatment

- Buttons use native elements for keyboard behavior.
- Selected queue items receive a visible cyan surface.
- Focus states use visible rings and do not rely on color alone.
- Severity badges combine text labels with color for accessibility.

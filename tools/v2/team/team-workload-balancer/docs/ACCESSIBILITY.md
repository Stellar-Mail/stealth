# Accessibility

## Goal

The Team Workload Balancer UI is designed to be accessible from the outset while remaining completely isolated from the main application.

This document describes the expected accessibility behavior for the local UI surface.

## Semantic Structure

The interface should use semantic HTML wherever possible.

Recommended elements include:

- `<section>`
- `<header>`
- `<h1>`–`<h3>`
- `<ul>` / `<li>`
- `<button>`
- `<progress>`
- `<dl>` / `<dt>` / `<dd>`

ARIA should supplement—not replace—semantic HTML.

## Keyboard Support

The interface is fully operable using a keyboard.

Supported interactions:

| Key         | Action                                  |
| ----------- | --------------------------------------- |
| Tab         | Move focus between interactive controls |
| Shift + Tab | Move focus backwards                    |
| Enter       | Activate the selected control           |
| Space       | Activate buttons                        |
| Escape      | Close temporary UI (future expansion)   |

No pointer-only interaction should be required.

## Focus Management

Interactive elements should:

- display a visible focus ring
- preserve logical tab order
- avoid keyboard traps
- return focus appropriately after temporary dialogs (future integration)

Recommended styling:

- `focus-visible:ring-2`
- `focus-visible:ring-ring`

## Screen Reader Support

Loading state:

- `aria-busy="true"`
- polite loading announcement

Error state:

- `role="alert"`

Progress indicators:

- descriptive `aria-label`
- workload values announced with associated member names

Buttons should use descriptive labels rather than icon-only controls.

## Color and Contrast

The UI inherits the application's design tokens without modification.

Requirements:

- WCAG AA text contrast
- focus indicators remain visible
- workload status is never communicated by color alone

## Responsive Behavior

The interface should remain usable across supported viewport sizes.

Cards should stack naturally while preserving keyboard navigation order.

## Out of Scope

This issue intentionally excludes:

- application routing
- mailbox integration
- authentication
- shared design system changes
- external accessibility tooling
- end-to-end accessibility testing

Those items should be handled by future integration issues.

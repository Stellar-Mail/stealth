# Internal Comment Thread (V1 Tool)

This folder contains the **Internal Comment Thread** component, built as an isolated V1 launch tool. It enables internal teammates to communicate directly on specific mail threads.

## 📖 Architecture & Guidelines

The tool remains owned by `src/tools/v1/team/internal-comment-thread/`. Its standalone
preview retains the original simulator for isolated review. The Work preview uses
the controlled `comments` and `onPost` props, with no seeded discussion or simulator
controls. The host owns session state and conversation isolation; this tool does not
make network requests or access a database.

## Work Integration

The controlled view uses shared glass and theme tokens for both dark and light
themes. It labels the notes as private, session-only, and never sent to mail
recipients. Reloading the app discards them. This is not shared team collaboration
or durable storage; those require an authorized backend before launch. Text is
rendered as escaped React content, not injected HTML.

## 🎨 Visual Design Specifications

The visual style is designed to be clean, modern, and aligned with a corporate dashboard UI:

- **Card Container:** Wrapped in a standard border (`border-gray-200`) with rounded corners (`rounded-xl`) and a subtle shadow (`shadow-sm`) over a white background (`bg-white`).
- **Typography:** Using standard modern fonts with varying weights (`font-semibold`, `font-medium`, `text-sm`, `text-xs`) to emphasize hierarchy.
- **Buttons:**
  - **Primary Action (Post Note):** `bg-indigo-600` transitioning to `bg-indigo-700` on hover, text white.
  - **Reset/Simulators:** Subdued shades (`bg-indigo-50`, `bg-yellow-50`, `bg-red-50`) to keep simulator controls visually distinct from production UI elements.
- **Comments List:** Comments are wrapped in cards with a light grey background (`bg-gray-50`) to group content cleanly.

## ♿ Accessibility (A11y) Features

Built with accessibility as a first-class citizen:

1. **ARIA Roles & Headings:**
   - The main card uses `role="region"` and `aria-labelledby` referencing the title, giving screen reader users clear semantic boundaries.
   - Textareas and buttons use clear semantic elements with proper names, requirements, and state indications (e.g. `aria-pressed`, `aria-required`).
2. **Keyboard Navigation & Focus Management:**
   - Each comment in the list is focusable using `tabIndex={0}`. Focus is trapped visually using `focus-within:ring-2 focus-within:ring-indigo-500` rings.
   - Posting a comment automatically scrolls to the newest comment and moves browser focus directly to it, allowing screen readers to immediately read the added text.
3. **Screen Reader Announcements (Live Regions):**
   - The comment list/container uses `aria-live="polite"` and `aria-atomic="true"` to dynamically announce state transitions (e.g. when comments finish loading, empty state indicators, or submission errors) without interrupting the user.

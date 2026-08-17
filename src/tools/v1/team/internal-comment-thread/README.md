# Internal Comment Thread (V1 Tool)

This folder contains the **Internal Comment Thread** component, built as an isolated V1 launch tool. It enables internal teammates to communicate directly on specific mail threads.

## 📖 Architecture & Guidelines

All work for this tool is kept inside `src/tools/v1/team/internal-comment-thread/`. It does not link to the main application shell, routing, or database layers.

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

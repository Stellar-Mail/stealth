# Accessibility (a11y) Design - Multi-Agent Assignment

The Multi-Agent Assignment console has been designed from the ground up to follow modern web accessibility standards, ensuring compatibility with screen readers, keyboard-only navigation, and high contrast styling.

---

## 1. Keyboard Usability

Keyboard-only users can fully navigate the interface and execute workflows:

- **Focus Indicators**: Focused elements (such as tabs, buttons, selectors, and inputs) have a distinct visual ring (`focus:outline-none focus:border-zinc-700` or custom focus rings) that makes it obvious which element has focus.
- **Logical Tab Order**: Elements are structured in standard document flow. Navigation moves predictably from header controls -> presets -> simulator inputs -> queue searches -> thread tabs -> thread action cards -> agent list controls -> log audit trails.
- **Escape Key Handling**: Sub-menus (like the agent assignment drop-down list) can be closed immediately by clicking away or selecting an option, maintaining clear control over layout overlays.

---

## 2. Screen Reader Support & Semantic HTML

We use appropriate HTML5 elements to structure the workspace:

- **Heading Hierarchy**: We use a single level-2 `<h2>` for the console title and `<h3>` for page sub-sections.
- **Interactive Toggles**: Search tabs use standard `<button>` tags with logical labels, avoiding non-semantic clickable divs.
- **Inputs and Forms**: Every simulator form field is paired with a clear, readable `<label>` matching its `id` attribute.
- **Aria Annotations**: List elements and dropdown options announce workload levels (e.g. `L:1` or `L:2`) and status indicators clearly.

---

## 3. High Contrast Theme Support

The application styling enforces WCAG 2.1 AA compliant color ratios:

- **Dark Mode Background**: A deep gray base (`bg-zinc-950` / `bg-zinc-900`) keeps eyes comfortable during long sessions.
- **Text Legibility**: Text is rendered in pure white (`text-zinc-100`) or light silver (`text-zinc-300`) to guarantee high contrast.
- **Priority and Status Indicators**: Badges utilize soft background colors paired with vibrant foreground text:
  - **High Priority / Critical Alerts**: Dark red background with bright red text (`bg-rose-500/10 text-rose-400`).
  - **Medium Priority / Warning Statuses**: Dark amber background with bright amber text (`bg-amber-500/10 text-amber-400`).
  - **Success / Active Statuses**: Dark green background with bright green text (`bg-emerald-500/5 text-emerald-400`).
  - **Offline / Default Tiers**: Dark zinc background with grey text (`bg-zinc-800 text-zinc-400`).

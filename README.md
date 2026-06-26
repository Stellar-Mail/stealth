# Stealth

> **Mail on your terms.**

**Stealth is a private, programmable mail protocol built on Stellar. You decide who can reach you, what unknown senders must pay, and which delivery claims deserve trust.**

Email was built to let anyone enter your inbox. That openness became spam, phishing, impersonation, and a security model held together by domain reputation. Stealth starts with a different rule: trusted people should reach you immediately. Everyone else must satisfy the policy you choose: verified identity, minimum postage, explicit approval, or no access at all.

---

## Run The Client

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
```

---

## Design Tokens

The Stealth client features a design-token system that decouples theme colors from individual components. Design tokens are defined as CSS custom properties under `src/styles/theme.css` and mapped to Tailwind semantic classes via `src/styles/tailwind.css`.

### Naming Convention

Design tokens are prefixed with `--theme-` and follow a strict categorical hierarchy:
`--theme-<category>-<variant>[-subvariant]`

Categories:
- **`bg`**: Backgrounds, panels, and surfaces (e.g. `--theme-bg-base`, `--theme-bg-surface-card`)
- **`text`**: Typography colors (e.g. `--theme-text-foreground`, `--theme-text-muted`)
- **`border`**: Borders and dividers (e.g. `--theme-border-base`)
- **`brand`**: Brand-related accent colors (e.g. `--theme-brand-base`, `--theme-brand-hover`)
- **`success` / `warning` / `destructive`**: Status indicator colors

### Usage in Components

Avoid branching on `theme === 'dark'` or embedding hex colors directly. Instead, use semantic Tailwind utility classes corresponding to these tokens:

| Tailwind Class | Token Reference | Purpose |
|---|---|---|
| `bg-background` | `--theme-bg-base` | Main application background |
| `bg-surface-card` | `--theme-bg-surface-card` | Container, card, and modal surfaces |
| `bg-surface-muted` | `--theme-bg-surface-muted` | Muted accents and background fills |
| `text-foreground` | `--theme-text-foreground` | Primary text |
| `text-muted-foreground` | `--theme-text-muted` | Secondary or helper text |
| `border-border` | `--theme-border-base` | Borders, lines, and dividers |
| `text-brand` / `bg-brand` | `--theme-brand-base` | Brand theme colors / calls-to-action |

### Applying Themes

Themes are controlled dynamically via the `ThemeProvider` (`src/shared/contexts/ThemeContext.tsx`). Flipped states are propagated to the DOM by:
1. Injecting the `.dark` class to the `document.documentElement` element to activate dark-mode variant utilities.
2. Setting the `data-theme` attribute (`data-theme="light" | "dark"`) to support styling rules scoped by attribute selectors.

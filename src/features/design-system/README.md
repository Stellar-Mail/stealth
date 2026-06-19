# Stealth UI system

The design system is the shared visual and interaction layer for feature-owned UI.

## Modules

- `styles/fonts.css` loads and assigns interface, preview, and long-form reader typography.
- `styles/tokens.css` defines color, radius, density, gradient, glass, and shadow values.
- `styles/surfaces.css` owns reusable glass, tile, modal, mail-list, and reader treatments.
- `styles/interactions.css` owns focus, scrolling, motion, selection, and reduced-motion behavior.
- `components/` contains typed action, surface, and empty-state primitives.
- `feedback/` contains queued application notifications and their accessible viewport.

Import React primitives from `@/features/design-system`. Global CSS modules are composed once by
`src/styles.css`; feature code should consume the resulting tokens and utility classes rather than
redeclaring their values.

Feature-specific layouts stay in their feature folders. A primitive belongs here only when it has a
stable API and is useful in more than one workflow.

## Motion System

The motion presets system (`@/lib/motion-presets`) provides centralized, accessible animations for consistent motion across the application.

### Quick Start

```tsx
import { motionPresets } from "@/lib/motion-presets";
import { motion, AnimatePresence } from "framer-motion";

<motion.div {...motionPresets.entrance.slideUp()}>Content with entrance animation</motion.div>;
```

### Categories

- **entrance** - Elements appearing (slideUp, fadeIn, scaleIn, slideLeft, slideRight)
- **exit** - Elements disappearing (slideDown, fadeOut, scaleOut, slideToLeft, slideToRight)
- **promote** - Drawing attention (scale, lift, glow) - use with hover/tap states
- **remove** - Removal emphasis (spinOut, collapse, slideAwayRight)
- **confirm** - Success feedback (bounce, pulse, checkmark)
- **danger** - Error/warning (shake, pulse, spinWarn)

### Accessibility

All presets automatically respect `prefers-reduced-motion`. See the development gallery for testing and examples:

```
http://localhost:5173/motion-gallery (dev mode only)
```

### Documentation

Full documentation is available in [`src/lib/MOTION_PRESETS.md`](../../lib/MOTION_PRESETS.md).

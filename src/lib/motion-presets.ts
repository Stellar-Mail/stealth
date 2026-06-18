/**
 * Motion Presets
 *
 * Centralized animation configuration for consistent motion across the application.
 * Supports reduced-motion preferences and respects accessibility guidelines.
 *
 * Usage:
 *   import { motionPresets } from "@/lib/motion-presets";
 *   const animation = motionPresets.entrance.slideUp();
 *   <motion.div initial={animation.initial} animate={animation.animate} transition={animation.transition} />
 *
 * Or with spread operator:
 *   <motion.div {...motionPresets.entrance.slideUp()} />
 */

// Check if user prefers reduced motion
const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Base animation configuration
const baseConfig = {
  duration: 0.3,
  springStiffness: 300,
  springDamping: 30,
} as const;

/**
 * Reduced motion alternatives - instant or minimal animation
 */
const reducedConfig = {
  duration: 0.01,
  springStiffness: 999,
  springDamping: 999,
} as const;

const getConfig = () => (prefersReducedMotion ? reducedConfig : baseConfig);

export type AnimationPreset = {
  initial: Record<string, any>;
  animate: Record<string, any>;
  exit?: Record<string, any>;
  transition: Record<string, any>;
  whileHover?: Record<string, any>;
  whileTap?: Record<string, any>;
};

/**
 * Entrance Animations
 * Used when elements appear or enter the screen
 */
export const entrance = {
  /**
   * Slide up from bottom with fade
   * Good for modals, panels, notifications
   */
  slideUp: (custom?: number): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 0, y: 16 + (custom ?? 0) },
      animate: { opacity: 1, y: 0 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },

  /**
   * Fade in only
   * Good for background overlays, text replacements
   */
  fadeIn: (): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: {
        duration: config.duration,
      },
    };
  },

  /**
   * Scale up from center with fade
   * Good for modals, popovers, alerts
   */
  scaleIn: (scale: number = 0.96): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 0, scale },
      animate: { opacity: 1, scale: 1 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },

  /**
   * Slide from left with fade
   * Good for sidebars, panels
   */
  slideLeft: (distance: number = 24): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 0, x: -distance },
      animate: { opacity: 1, x: 0 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },

  /**
   * Slide from right with fade
   * Good for slide-out panels, drawers
   */
  slideRight: (distance: number = 24): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 0, x: distance },
      animate: { opacity: 1, x: 0 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },
} as const;

/**
 * Exit Animations
 * Used when elements disappear or leave the screen
 */
export const exit = {
  /**
   * Slide down with fade
   * Used with entrance.slideUp for balance
   */
  slideDown: (custom?: number): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 16 + (custom ?? 0) },
      animate: { opacity: 1, y: 0 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },

  /**
   * Fade out only
   * Used with entrance.fadeIn for balance
   */
  fadeOut: (): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 1 },
      exit: { opacity: 0 },
      animate: { opacity: 1 },
      transition: {
        duration: config.duration,
      },
    };
  },

  /**
   * Scale down to center with fade
   * Used with entrance.scaleIn for balance
   */
  scaleOut: (scale: number = 0.96): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale },
      animate: { opacity: 1, scale: 1 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },

  /**
   * Slide to left with fade
   * Used with entrance.slideLeft for balance
   */
  slideToLeft: (distance: number = 24): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -distance },
      animate: { opacity: 1, x: 0 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },

  /**
   * Slide to right with fade
   * Used with entrance.slideRight for balance
   */
  slideToRight: (distance: number = 24): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: distance },
      animate: { opacity: 1, x: 0 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },
} as const;

/**
 * Promote Animations
 * Used to draw attention to elements, bring them to focus
 * Typically used with tap/hover interactions
 */
export const promote = {
  /**
   * Subtle scale increase on hover/focus
   * Good for buttons, cards, interactive elements
   */
  scale: (scale: number = 1.02): AnimationPreset => {
    return {
      initial: { scale: 1 },
      animate: { scale: 1 },
      whileHover: { scale },
      whileTap: { scale: scale * 0.98 },
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 17,
        duration: 0.2,
      },
    };
  },

  /**
   * Lift effect with shadow and slight upward movement
   * Good for cards, elevated elements
   */
  lift: (): AnimationPreset => {
    return {
      initial: { y: 0, boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.1)" },
      animate: { y: 0 },
      whileHover: {
        y: -4,
        boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.15)",
      },
      whileTap: { y: -2 },
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 17,
        duration: 0.2,
      },
    };
  },

  /**
   * Highlight with glow effect (color/opacity increase)
   * Good for focus states, highlighting active items
   */
  glow: (): AnimationPreset => {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      whileHover: { opacity: 1.1 },
      transition: {
        duration: 0.2,
      },
    };
  },
} as const;

/**
 * Remove Animations
 * Used when removing elements with emphasis
 * Typically used with interactive destruction (delete, dismiss)
 */
export const remove = {
  /**
   * Spin out with fade
   * Good for deleting items, dismissing notifications
   */
  spinOut: (): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 1, rotate: 0, scale: 1 },
      exit: { opacity: 0, rotate: 90, scale: 0.8 },
      animate: { opacity: 1, rotate: 0, scale: 1 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },

  /**
   * Collapse height with fade
   * Good for list items, removable elements
   */
  collapse: (): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 1, height: "auto", paddingTop: 0, paddingBottom: 0 },
      exit: { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 },
      animate: { opacity: 1, height: "auto" },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },

  /**
   * Slide to right and fade (dismissal)
   * Good for dismissible alerts, notifications
   */
  slideAwayRight: (): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 100 },
      animate: { opacity: 1, x: 0 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },
} as const;

/**
 * Confirm Animations
 * Used for positive actions, confirmations
 * Provides visual feedback for success states
 */
export const confirm = {
  /**
   * Bounce in with success feel
   * Good for success messages, confirmations
   */
  bounce: (): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 0, scale: 0.8, y: 12 },
      animate: { opacity: 1, scale: 1, y: 0 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },

  /**
   * Pulse effect (scale oscillation)
   * Good for highlighting confirmation, success state
   */
  pulse: (): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { scale: 1 },
      animate: { scale: [1, 1.05, 1] },
      transition: {
        duration: config.duration * 1.5,
        ease: "easeInOut",
      },
    };
  },

  /**
   * Quick check mark appear (scale in from center)
   * Good for checkmarks, validation success
   */
  checkmark: (): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 0, scale: 0 },
      animate: { opacity: 1, scale: 1 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },
} as const;

/**
 * Danger Animations
 * Used for destructive actions, warnings, errors
 * Provides visual feedback for critical states
 */
export const danger = {
  /**
   * Shake effect (horizontal oscillation)
   * Good for errors, invalid input
   */
  shake: (): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { x: 0 },
      animate: { x: [0, -6, 6, -6, 0] },
      transition: {
        duration: config.duration * 1.2,
        ease: "easeInOut",
      },
    };
  },

  /**
   * Pulse with color shift (opacity increase)
   * Good for warnings, alerts
   */
  pulse: (): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.7, 1] },
      transition: {
        duration: config.duration * 1.5,
        ease: "easeInOut",
      },
    };
  },

  /**
   * Spin with fade (warning indicator)
   * Good for loading errors, system warnings
   */
  spinWarn: (): AnimationPreset => {
    const config = getConfig();
    return {
      initial: { opacity: 0, rotate: -180 },
      animate: { opacity: 1, rotate: 0 },
      transition: {
        type: "spring",
        stiffness: config.springStiffness,
        damping: config.springDamping,
        duration: config.duration,
      },
    };
  },
} as const;

/**
 * Combined presets for common patterns
 */
export const patterns = {
  /**
   * Modal/Dialog pattern
   * Combines backdrop fade + content scale
   */
  modal: {
    backdrop: entrance.fadeIn(),
    content: entrance.scaleIn(0.96),
  },

  /**
   * Notification/Toast pattern
   * Entrance from top, exit to top
   */
  notification: {
    entrance: entrance.slideUp(8),
    exit: exit.slideDown(8),
  },

  /**
   * Sidebar/Panel pattern
   * Slide from side with overlay
   */
  sidePanel: {
    backdrop: entrance.fadeIn(),
    panel: entrance.slideLeft(24),
  },

  /**
   * List item pattern
   * Staggered children with remove option
   */
  listItem: {
    entrance: entrance.slideUp(8),
    exit: remove.collapse(),
  },
} as const;

/**
 * Transition config presets
 * Use with transition prop directly
 */
export const transitions = {
  /**
   * Standard spring transition - snappy and natural
   */
  spring: {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
    duration: 0.3,
  },

  /**
   * Smooth spring - slower and more elastic
   */
  springSmooth: {
    type: "spring" as const,
    stiffness: 200,
    damping: 20,
    duration: 0.4,
  },

  /**
   * Snappy spring - faster and tighter
   */
  springSnappy: {
    type: "spring" as const,
    stiffness: 400,
    damping: 40,
    duration: 0.2,
  },

  /**
   * Linear timing - good for continuous animations
   */
  linear: {
    type: "tween" as const,
    duration: 0.3,
    ease: "linear" as const,
  },

  /**
   * Ease in-out timing - natural acceleration/deceleration
   */
  easeInOut: {
    type: "tween" as const,
    duration: 0.3,
    ease: "easeInOut" as const,
  },
} as const;

/**
 * Duration presets in seconds
 */
export const durations = {
  instant: 0,
  fast: 0.15,
  base: 0.3,
  slow: 0.5,
  slower: 0.7,
} as const;

/**
 * Easing function presets
 */
export const easings = {
  linear: "linear",
  easeIn: "easeIn",
  easeOut: "easeOut",
  easeInOut: "easeInOut",
  circIn: "circIn",
  circOut: "circOut",
  circInOut: "circInOut",
  backIn: "backIn",
  backOut: "backOut",
  backInOut: "backInOut",
  anticipate: "anticipate",
} as const;

/**
 * Helper function to check if user prefers reduced motion
 */
export function getMotionPreference(): "full" | "reduced" {
  return prefersReducedMotion ? "reduced" : "full";
}

/**
 * Motion presets aggregated for convenience
 */
export const motionPresets = {
  entrance,
  exit,
  promote,
  remove,
  confirm,
  danger,
  patterns,
  transitions,
  durations,
  easings,
  getMotionPreference,
} as const;

export type MotionPreset = typeof motionPresets;

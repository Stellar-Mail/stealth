/**
 * Action Motion Presets
 *
 * Consistent, subtle motion patterns for archive, star, snooze, approve,
 * block, refund, and copy-proof actions.
 *
 * Design principles:
 * - Avoid novelty; interactions reinforce state and confidence
 * - Immediate feedback before server confirmation
 * - Failed optimistic actions roll back visibly and accessibly
 * - Respects reduced-motion preferences
 * - Haptic-like timing using spring physics
 */

import { type AnimationPreset } from "./motion-presets";

/* -------------------------------------------------------------------------- */
/*  Reduced-motion detection                                                   */
/* -------------------------------------------------------------------------- */

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const RM = prefersReducedMotion;

/* -------------------------------------------------------------------------- */
/*  Duration & easing tokens                                                   */
/* -------------------------------------------------------------------------- */

export const actionDurations = {
  /** Instant visual feedback (icon swap, color shift) — 80ms */
  instant: RM ? 0 : 0.08,
  /** Quick confirmation pulse — 200ms */
  quick: RM ? 0 : 0.2,
  /** Standard action feedback — 350ms */
  standard: RM ? 0 : 0.35,
  /** Row removal / collapse — 400ms */
  removal: RM ? 0 : 0.4,
  /** Rollback animation — 500ms */
  rollback: RM ? 0 : 0.5,
} as const;

export const actionEasings = {
  /** Snappy, responsive feel */
  snappy: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
  /** Smooth deceleration */
  smooth: [0.4, 0, 0.2, 1] as [number, number, number, number],
  /** Bouncy for confirmations */
  bouncy: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
} as const;

/* -------------------------------------------------------------------------- */
/*  Icon state change animations                                               */
/* -------------------------------------------------------------------------- */

/**
 * Icon swap animation — subtle scale + rotate for icon transitions.
 * Used when an icon changes state (e.g., star outline → filled).
 */
export function iconSwap(): AnimationPreset {
  return {
    initial: { scale: 1, rotate: 0 },
    animate: { scale: [1, 1.2, 1], rotate: [0, 15, 0] },
    transition: {
      duration: actionDurations.quick,
      ease: actionEasings.snappy,
    },
  };
}

/**
 * Star toggle — quick scale pulse with color transition.
 * The fill color is handled via CSS transition; this adds the haptic-like pop.
 */
export function starToggle(becomingActive: boolean): AnimationPreset {
  return {
    initial: { scale: 1 },
    animate: becomingActive
      ? { scale: [1, 1.35, 1], rotate: [0, -10, 0] }
      : { scale: [1, 0.85, 1] },
    transition: {
      duration: actionDurations.quick,
      ease: actionEasings.bouncy,
    },
  };
}

/**
 * Archive icon — slides the icon left briefly to suggest "moving out".
 */
export function archiveIcon(): AnimationPreset {
  return {
    initial: { x: 0, opacity: 1 },
    animate: { x: [0, -4, 0], opacity: [1, 0.5, 1] },
    transition: {
      duration: actionDurations.quick,
      ease: actionEasings.snappy,
    },
  };
}

/**
 * Snooze icon — gentle clock-hand rotation to suggest "later".
 */
export function snoozeIcon(): AnimationPreset {
  return {
    initial: { rotate: 0 },
    animate: { rotate: [0, -30, 0] },
    transition: {
      duration: actionDurations.standard,
      ease: actionEasings.smooth,
    },
  };
}

/**
 * Approve icon — checkmark scale-in with bounce.
 */
export function approveIcon(): AnimationPreset {
  return {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: [0, 1.3, 1], opacity: 1 },
    transition: {
      duration: actionDurations.quick,
      ease: actionEasings.bouncy,
    },
  };
}

/**
 * Block icon — shake + fade to red.
 */
export function blockIcon(): AnimationPreset {
  return {
    initial: { x: 0, opacity: 1 },
    animate: { x: [0, -3, 3, -2, 2, 0], opacity: 1 },
    transition: {
      duration: actionDurations.quick,
      ease: actionEasings.snappy,
    },
  };
}

/**
 * Copy proof — brief flash + scale to indicate clipboard action.
 */
export function copyProofIcon(): AnimationPreset {
  return {
    initial: { scale: 1, opacity: 1 },
    animate: { scale: [1, 1.15, 1], opacity: [1, 0.7, 1] },
    transition: {
      duration: actionDurations.quick,
      ease: actionEasings.snappy,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Row / card removal animations                                              */
/* -------------------------------------------------------------------------- */

/**
 * Row collapse — used when an email row is removed from the list
 * after archive, trash, approve, block, or refund.
 */
export function rowCollapse(): AnimationPreset {
  return {
    initial: { opacity: 1, height: "auto", scale: 1, marginBottom: 8 },
    exit: {
      opacity: 0,
      height: 0,
      scale: 0.95,
      marginBottom: 0,
      paddingTop: 0,
      paddingBottom: 0,
    },
    animate: { opacity: 1, height: "auto", scale: 1 },
    transition: {
      duration: actionDurations.removal,
      ease: actionEasings.smooth,
    },
  };
}

/**
 * Slide-out to the right — used for dismissive actions like archive.
 */
export function slideOutRight(): AnimationPreset {
  return {
    initial: { x: 0, opacity: 1 },
    exit: { x: 60, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    transition: {
      duration: actionDurations.standard,
      ease: actionEasings.snappy,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Optimistic update rollback                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Rollback animation — used when an optimistic update fails and
 * the UI needs to revert to its previous state visibly.
 * Shakes the element to indicate the failure, then restores.
 */
export function rollback(): AnimationPreset {
  return {
    initial: { x: 0, opacity: 1 },
    animate: RM
      ? { opacity: [1, 0.6, 1] }
      : {
          x: [0, -6, 6, -4, 4, 0],
          opacity: [1, 0.6, 1],
        },
    transition: {
      duration: actionDurations.rollback,
      ease: actionEasings.smooth,
    },
  };
}

/**
 * Rollback with color flash — for destructive actions that need
 * extra attention (block, refund).
 */
export function rollbackDanger(): AnimationPreset {
  return {
    initial: { x: 0, opacity: 1 },
    animate: RM
      ? { opacity: [1, 0.5, 1] }
      : {
          x: [0, -8, 8, -5, 5, 0],
          opacity: [1, 0.5, 1],
        },
    transition: {
      duration: actionDurations.rollback,
      ease: actionEasings.smooth,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Confirmation / success feedback                                            */
/* -------------------------------------------------------------------------- */

/**
 * Success pulse — brief scale-up to confirm the action completed.
 * Used as immediate feedback before server confirmation.
 */
export function successPulse(): AnimationPreset {
  return {
    initial: { scale: 1 },
    animate: { scale: [1, 1.06, 1] },
    transition: {
      duration: actionDurations.quick,
      ease: actionEasings.bouncy,
    },
  };
}

/**
 * Toast entrance with haptic-like timing.
 * Faster than standard toasts to feel responsive.
 */
export function actionToastEntrance(): AnimationPreset {
  return {
    initial: RM ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 },
    animate: RM ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 },
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 28,
      mass: 0.8,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Aggregate export                                                           */
/* -------------------------------------------------------------------------- */

export const actionMotions = {
  iconSwap,
  starToggle,
  archiveIcon,
  snoozeIcon,
  approveIcon,
  blockIcon,
  copyProofIcon,
  rowCollapse,
  slideOutRight,
  rollback,
  rollbackDanger,
  successPulse,
  actionToastEntrance,
  durations: actionDurations,
  easings: actionEasings,
} as const;

export type ActionMotion = typeof actionMotions;
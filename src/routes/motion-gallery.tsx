import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  type AnimationPreset,
  motionPresets,
  entrance,
  exit,
  promote,
  remove,
  confirm,
  danger,
  getMotionPreference,
} from "@/lib/motion-presets";
import { Settings, Play, RotateCcw } from "lucide-react";

const presetCategories = [
  {
    title: "Entrance",
    description: "Animations for elements appearing or entering the screen",
    presets: [
      {
        name: "Slide Up",
        key: "slideUp",
        description: "Slide up from bottom with fade - modals, panels, notifications",
        variant: entrance.slideUp(),
      },
      {
        name: "Fade In",
        key: "fadeIn",
        description: "Fade in only - overlays, text replacements",
        variant: entrance.fadeIn(),
      },
      {
        name: "Scale In",
        key: "scaleIn",
        description: "Scale up from center with fade - modals, popovers, alerts",
        variant: entrance.scaleIn(0.96),
      },
      {
        name: "Slide Left",
        key: "slideLeft",
        description: "Slide from left with fade - sidebars, panels",
        variant: entrance.slideLeft(24),
      },
      {
        name: "Slide Right",
        key: "slideRight",
        description: "Slide from right with fade - slide-out panels, drawers",
        variant: entrance.slideRight(24),
      },
    ],
  },
  {
    title: "Exit",
    description: "Animations for elements disappearing or leaving the screen",
    presets: [
      {
        name: "Slide Down",
        key: "slideDown",
        description: "Slide down with fade - opposite of slide up",
        variant: exit.slideDown(),
      },
      {
        name: "Fade Out",
        key: "fadeOut",
        description: "Fade out only - opposite of fade in",
        variant: exit.fadeOut(),
      },
      {
        name: "Scale Out",
        key: "scaleOut",
        description: "Scale down to center with fade - opposite of scale in",
        variant: exit.scaleOut(0.96),
      },
      {
        name: "Slide to Left",
        key: "slideToLeft",
        description: "Slide to left with fade",
        variant: exit.slideToLeft(24),
      },
      {
        name: "Slide to Right",
        key: "slideToRight",
        description: "Slide to right with fade",
        variant: exit.slideToRight(24),
      },
    ],
  },
  {
    title: "Promote",
    description: "Animations to draw attention and bring elements to focus",
    presets: [
      {
        name: "Scale",
        key: "scale",
        description: "Subtle scale increase on hover - buttons, cards, interactive elements",
        variant: promote.scale(1.02),
        isInteractive: true,
      },
      {
        name: "Lift",
        key: "lift",
        description: "Lift effect with shadow and upward movement - cards, elevated elements",
        variant: promote.lift(),
        isInteractive: true,
      },
      {
        name: "Glow",
        key: "glow",
        description: "Highlight with glow effect - focus states, active items",
        variant: promote.glow(),
        isInteractive: true,
      },
    ],
  },
  {
    title: "Remove",
    description: "Animations when removing elements with emphasis",
    presets: [
      {
        name: "Spin Out",
        key: "spinOut",
        description: "Spin out with fade - deleting items, dismissing notifications",
        variant: remove.spinOut(),
      },
      {
        name: "Collapse",
        key: "collapse",
        description: "Collapse height with fade - list items, removable elements",
        variant: remove.collapse(),
      },
      {
        name: "Slide Away Right",
        key: "slideAwayRight",
        description: "Slide to right and fade - dismissible alerts, notifications",
        variant: remove.slideAwayRight(),
      },
    ],
  },
  {
    title: "Confirm",
    description: "Animations for positive actions and confirmation feedback",
    presets: [
      {
        name: "Bounce",
        key: "bounce",
        description: "Bounce in with success feel - success messages, confirmations",
        variant: confirm.bounce(),
      },
      {
        name: "Pulse",
        key: "pulse",
        description: "Pulse effect (scale oscillation) - highlighting confirmation, success",
        variant: confirm.pulse(),
      },
      {
        name: "Checkmark",
        key: "checkmark",
        description: "Quick check mark appear - checkmarks, validation success",
        variant: confirm.checkmark(),
      },
    ],
  },
  {
    title: "Danger",
    description: "Animations for destructive actions, warnings, and errors",
    presets: [
      {
        name: "Shake",
        key: "shake",
        description: "Shake effect (horizontal oscillation) - errors, invalid input",
        variant: danger.shake(),
      },
      {
        name: "Pulse (Warning)",
        key: "pulseWarn",
        description: "Pulse with opacity shift - warnings, alerts",
        variant: danger.pulse(),
      },
      {
        name: "Spin Warn",
        key: "spinWarn",
        description: "Spin with fade - loading errors, system warnings",
        variant: danger.spinWarn(),
      },
    ],
  },
];

type PresetCategory = (typeof presetCategories)[number];
type PresetItem = PresetCategory["presets"][number] & {
  variant: AnimationPreset;
  isInteractive?: boolean;
};

interface AnimationDemo {
  categoryIndex: number;
  presetIndex: number;
}

function AnimationPreview({
  variant,
  isInteractive,
  onReset,
}: {
  variant: AnimationPreset;
  isInteractive?: boolean;
  onReset: () => void;
}) {
  const [showDemo, setShowDemo] = useState(true);

  const handleReset = () => {
    setShowDemo(false);
    setTimeout(() => setShowDemo(true), 50);
    onReset();
  };

  if (isInteractive) {
    return (
      <motion.div
        className="w-full h-32 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center cursor-pointer"
        {...variant}
        key={showDemo ? "shown" : "hidden"}
      >
        <div className="text-center text-sm font-medium text-foreground">
          Hover or click to see animation
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {showDemo && (
          <motion.div
            key="demo"
            initial={variant.initial}
            animate={variant.animate}
            exit={variant.exit}
            transition={variant.transition}
            className="w-full h-32 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center"
          >
            <div className="text-center text-sm font-medium text-foreground">Animation preview</div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleReset}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
      >
        <RotateCcw className="h-4 w-4" />
        Replay
      </button>
    </div>
  );
}

export function MotionGalleryRoute() {
  const [expandedCategory, setExpandedCategory] = useState<number>(0);
  const [expandedPreset, setExpandedPreset] = useState<AnimationDemo | null>({
    categoryIndex: 0,
    presetIndex: 0,
  });
  const [isReducedMotion, setIsReducedMotion] = useState(getMotionPreference() === "reduced");
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const isDev = import.meta.env.DEV;

  if (!isDev) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Motion Gallery</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This route is only available in development mode.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Motion Gallery</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Development panel for testing animations, easing, and reduced-motion behavior
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <label htmlFor="reduced-motion" className="text-sm font-medium">
                  Reduced Motion:
                </label>
                <input
                  id="reduced-motion"
                  type="checkbox"
                  checked={isReducedMotion}
                  onChange={(e) => {
                    setIsReducedMotion(e.target.checked);
                    // This is just for demo purposes - in real scenario,
                    // the system would read from browser preference
                  }}
                  className="h-4 w-4"
                />
              </div>
              {isReducedMotion && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  ⚠ Reduced motion: durations are minimized
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* Quick Reference */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">Quick Reference</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Import motion presets in your components:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs font-mono text-foreground">
            {`import { motionPresets } from "@/lib/motion-presets";

// Use preset variants
<motion.div {...motionPresets.entrance.slideUp()} />

// Use transitions directly
<motion.div transition={motionPresets.transitions.spring} />

// Check motion preference
const preference = motionPresets.getMotionPreference();`}
          </pre>
        </div>

        {/* Animation Categories */}
        <div className="space-y-4">
          {presetCategories.map((category, categoryIndex) => (
            <div key={category.title} className="overflow-hidden rounded-lg border border-border">
              {/* Category Header */}
              <button
                onClick={() =>
                  setExpandedCategory(expandedCategory === categoryIndex ? -1 : categoryIndex)
                }
                className="w-full bg-card px-6 py-4 text-left transition hover:bg-accent/50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-foreground">{category.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
                  </div>
                  <motion.div
                    animate={{
                      rotate: expandedCategory === categoryIndex ? 180 : 0,
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg
                      className="h-5 w-5 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </motion.div>
                </div>
              </button>

              {/* Category Content */}
              <AnimatePresence>
                {expandedCategory === categoryIndex && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border bg-background/50 px-6 py-6">
                      <div className="space-y-6">
                        {category.presets.map((preset: PresetItem, presetIndex) => (
                          <div key={preset.key} className="space-y-3">
                            {/* Preset Header */}
                            <button
                              onClick={() =>
                                setExpandedPreset(
                                  expandedPreset?.categoryIndex === categoryIndex &&
                                    expandedPreset?.presetIndex === presetIndex
                                    ? null
                                    : { categoryIndex, presetIndex },
                                )
                              }
                              className="w-full text-left transition hover:opacity-70"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="font-medium text-foreground">{preset.name}</h3>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {preset.description}
                                  </p>
                                </div>
                                <Play className="h-4 w-4 text-primary" />
                              </div>
                            </button>

                            {/* Preview */}
                            <AnimatePresence>
                              {expandedPreset?.categoryIndex === categoryIndex &&
                                expandedPreset?.presetIndex === presetIndex && (
                                  <motion.div
                                    key={`preview-${categoryIndex}-${presetIndex}`}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="rounded-lg bg-card p-4"
                                  >
                                    <AnimationPreview
                                      key={resetKey}
                                      variant={preset.variant}
                                      isInteractive={preset.isInteractive}
                                      onReset={() => setResetKey((k) => k + 1)}
                                    />
                                  </motion.div>
                                )}
                            </AnimatePresence>

                            {categoryIndex !== presetCategories.length - 1 && (
                              <div className="h-px bg-border/50" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Usage Guide */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Usage Guide</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-medium text-foreground">When to use each preset:</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Entrance</strong> - Elements appearing or
                  entering the viewport
                </li>
                <li>
                  <strong className="text-foreground">Exit</strong> - Elements disappearing or
                  leaving the viewport
                </li>
                <li>
                  <strong className="text-foreground">Promote</strong> - User interactions,
                  hover/focus states
                </li>
                <li>
                  <strong className="text-foreground">Remove</strong> - Item deletion or dismissal
                  with emphasis
                </li>
                <li>
                  <strong className="text-foreground">Confirm</strong> - Positive feedback and
                  success states
                </li>
                <li>
                  <strong className="text-foreground">Danger</strong> - Errors, warnings, and
                  destructive actions
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Accessibility Notes:</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>
                  All presets respect <code className="font-mono">prefers-reduced-motion</code>
                </li>
                <li>Reduced motion sets durations to ~0.01ms</li>
                <li>Test with reduced motion enabled in OS settings</li>
                <li>Combine with focus states for keyboard navigation</li>
                <li>Avoid excessive animations on critical paths</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Implementation Examples */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Implementation Examples</h2>
          <div className="mt-4 space-y-4">
            <details className="group">
              <summary className="cursor-pointer font-medium text-foreground hover:text-primary">
                Modal Dialog
              </summary>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs font-mono text-foreground">
                {`import { motion, AnimatePresence } from "framer-motion";
import { motionPresets } from "@/lib/motion-presets";

export function Modal({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            {...motionPresets.patterns.modal.backdrop}
            onClick={onClose}
            className="fixed inset-0 bg-black/50"
          />
          <motion.div
            {...motionPresets.patterns.modal.content}
            className="fixed inset-0 flex items-center justify-center"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}`}
              </pre>
            </details>
            <details className="group">
              <summary className="cursor-pointer font-medium text-foreground hover:text-primary">
                Interactive Button
              </summary>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs font-mono text-foreground">
                {`import { motion } from "framer-motion";
import { motionPresets } from "@/lib/motion-presets";

export function InteractiveButton() {
  return (
    <motion.button
      {...motionPresets.promote.scale(1.04)}
      onClick={() => console.log("clicked")}
      className="px-4 py-2 rounded-lg bg-primary"
    >
      Click me
    </motion.button>
  );
}`}
              </pre>
            </details>
            <details className="group">
              <summary className="cursor-pointer font-medium text-foreground hover:text-primary">
                Staggered List Items
              </summary>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs font-mono text-foreground">
                {`import { motion } from "framer-motion";
import { motionPresets } from "@/lib/motion-presets";

export function ListItems({ items }) {
  return (
    <motion.div initial="hidden" animate="visible" variants={{}}>
      {items.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            ...motionPresets.transitions.spring,
            delay: i * 0.05,
          }}
        >
          {item.label}
        </motion.div>
      ))}
    </motion.div>
  );
}`}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/motion-gallery")({
  component: MotionGalleryRoute,
});

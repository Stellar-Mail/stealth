export { ActionButton } from "./components/action-button";
export { actionButtonVariants } from "./components/action-button.styles";
export { EmptyState } from "./components/empty-state";
export { Surface } from "./components/surface";
export { FeedbackViewport } from "./feedback/feedback-viewport";
export { useFeedback } from "./feedback/use-feedback";

export type { ActionButtonProps } from "./components/action-button";
export type { EmptyStateProps } from "./components/empty-state";
export type { SurfacePadding, SurfaceProps, SurfaceVariant } from "./components/surface";
export type { FeedbackViewportProps } from "./feedback/feedback-viewport";
export type { FeedbackItem, FeedbackTone, NotifyOptions } from "./feedback/use-feedback";

export { TrustBadge, TRUST_STATE_META } from "./components/trust-badge";
export type {
  TrustState,
  TrustStateMeta,
  TrustBadgeProps,
  TrustBadgeSize,
} from "./components/trust-badge";

// Skeleton primitives & screens
export { SkeletonBlock, SkeletonText, SkeletonAvatar, SkeletonButton } from "./components/skeleton";
export type {
  SkeletonBlockProps,
  SkeletonTextProps,
  SkeletonAvatarProps,
  SkeletonButtonProps,
} from "./components/skeleton";

export {
  MailListSkeleton,
  MailReaderSkeleton,
  CalendarSkeleton,
  SettingsSkeleton,
  RightPanelSkeleton,
} from "./components/skeleton-screens";

# Visual Style

## Design Goals

The UI follows the existing design language without modifying shared design tokens.

## Layout

- Rounded cards
- Consistent spacing
- Responsive single-column workflow

## States

### Empty

Illustration, description, and primary action.

### Loading

Skeleton placeholders with loading announcement.

### Error

Alert container with retry action.

### Success

Summary card followed by confirmation.

## Components

- EmptyState
- LoadingState
- ErrorState
- PayoutForm
- PayoutSummary
- PayoutSuccess

## Future Integration

This document describes only the local UI surface. Mounting the tool into the application should be completed in a separate integration issue.

# Visual Style Guidelines

## Overview

The Manager Review Queue local components use standard Tailwind CSS utility classes to define their styling. This ensures the component is self-contained and does not conflict with or require modifications to the main app's global design system.

## Color Palette

The components rely on semantic color mappings from the standard Tailwind palette:

- **Primary Actions (Approve)**: Green (`bg-green-600`, `hover:bg-green-700`)
- **Destructive Actions (Reject)**: Red (`bg-red-600`, `hover:bg-red-700`)
- **Warning/Escalation Actions**: Yellow/Amber (`bg-yellow-500`, `hover:bg-yellow-600`)
- **Backgrounds**: Soft grays and whites (`bg-white`, `bg-gray-50`)
- **Typography**: Dark grays for high contrast (`text-gray-900`, `text-gray-700`, `text-gray-500`)

## State Indication

- **Loading**: A simple CSS-animated spinner (`animate-spin`) using border colors to indicate progress.
- **Success/Error**: Banners use light pastel backgrounds (`bg-green-50`, `bg-red-50`) with deeper contrasting text (`text-green-800`, `text-red-800`) to stand out without being visually overwhelming.
- **Empty**: A dashed border (`border-dashed border-gray-300`) with a muted SVG icon and text represents a zero-state, encouraging the user.

## Typography and Spacing

- Maximum container widths (`max-w-5xl`, `max-w-4xl`) ensure readability on ultrawide monitors.
- Consistent padding and gaps (`p-6`, `p-4`, `gap-4`) provide a comfortable breathing room between elements.
- The `ReviewQueueItem` uses an italicized left-bordered section (`border-l-2 border-gray-200 pl-3 italic`) to cleanly offset the content snippet from the structural metadata.

## Responsiveness

- The list items stack vertically on mobile (`flex-col`) and transition to a horizontal layout (`sm:flex-row`) on larger screens, keeping actions easily accessible near the thumb/bottom on phones and on the right side on desktops.

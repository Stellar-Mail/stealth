# Hooks

React hooks for the Team Digest Generator tool.

## Module Responsibility

- Local state management for digest configuration
- Data fetching hooks
- Form validation hooks
- Preview generation hooks
- Local persistence

## Constraints

- Do not wire to main app authentication
- Use local-only state management
- No global store modifications
- No side effects beyond component scope

## Hooks to Implement

### `useDigestConfig`

- Manage digest configuration state (recipients, filters, schedule)
- Persist to local storage
- Validate configuration changes
- Export/import configuration

### `useDigestPreview`

- Generate digest preview
- Handle loading/error states
- Cache preview results
- Update preview on config changes

### `useTeamValidation`

- Validate team member input
- Check for duplicates
- Handle invalid entries
- Report validation errors

### `useScheduleValidation`

- Validate cron/schedule expressions
- Calculate next digest time
- Handle timezone awareness
- Report schedule errors

## Guidelines

- Keep hooks focused and single-purpose
- Use local state or context, not global store
- Handle loading, success, and error states
- Write custom hooks for reusable logic
- Document dependencies and side effects

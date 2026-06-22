# Components

UI components for the Team Digest Generator tool.

## Module Responsibility

- Render digest configuration interface
- Display digest preview
- Team member selection UI
- Digest scheduling controls
- Status and feedback UI

## Integration Constraints

- Use only public design system exports
- No direct database access
- No authentication logic
- No wallet or Stellar integration
- Import only from this tool's services and hooks

## Components to Implement

- `DigestConfigForm` - Configure digest settings (recipients, schedule, filters)
- `DigestPreview` - Show digest preview before sending
- `TeamMemberSelector` - Multi-select for team members
- `DigestScheduleSelector` - Configure digest timing
- `DigestStatus` - Display generation/sending status

## Guidelines

- Keep components focused on UI only
- Use services for all business logic
- Write tests for all components
- Document props and usage

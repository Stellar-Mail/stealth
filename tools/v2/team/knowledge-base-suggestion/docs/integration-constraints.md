# Integration Constraints

## Allowed

- Standard TypeScript and browser APIs
- React inside future folder-local hooks and components
- Existing test tooling without changing root configuration
- Imports between modules inside this tool directory
- Dependency injection through typed folder-local interfaces

## Forbidden in This Issue

- Main application shell, dashboard, navigation, or routing changes
- Authentication, wallet, Stellar, inbox, mail-rendering, or database changes
- Imports from main-app stores, contexts, services, routes, or design-system files
- Direct network calls to knowledge-base or search providers
- Root dependency or build-configuration changes
- Files changed outside `tools/v2/team/knowledge-base-suggestion/`

## Future Integration

Integration requires a separate issue that defines an adapter owned by the
consumer. The adapter must authorize and sanitize candidate article snapshots
before passing them to this tool and must re-check authorization before opening or
inserting article content.

Any proposed cross-boundary import, persistence mechanism, provider SDK, route, or
global UI registration requires maintainer approval before implementation.

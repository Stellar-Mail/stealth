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
- Direct network calls to ticket providers
- Root dependency or build-configuration changes
- Files changed outside `tools/v2/team/mail-to-ticket-converter/`

## Future Integration

Integration requires a separate issue that defines an adapter owned by the
consumer. The adapter may map application data to this tool's public contracts,
but must not expose internal application objects or credentials to local services.

Any proposed cross-boundary import, persistence mechanism, provider SDK, route, or
global UI registration requires maintainer approval before implementation.

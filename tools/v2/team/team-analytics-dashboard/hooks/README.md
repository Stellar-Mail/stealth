# Hooks

This folder is reserved for future dashboard hooks.

Allowed here:

- local query state
- filter state
- derived analytics state
- view lifecycle helpers

Not allowed here:

- global application state coupling
- routing side effects
- inbox or wallet integration
- shared design system changes

Hooks in this folder should depend on local services or local fixtures only.

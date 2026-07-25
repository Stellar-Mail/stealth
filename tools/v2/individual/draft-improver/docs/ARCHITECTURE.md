# Draft Improver Architecture

This document defines the architectural contract for the Draft Improver tool. As a V2 later-release individual tool, it functions as a self-contained mini-product.

## Module Boundaries

To maintain separation of concerns, the internal structure is strictly divided as follows:

- **components/**: Contains all React components. Components should primarily be presentational. Any complex logic should be extracted to hooks or services.
- **hooks/**: Custom React hooks for managing state and side-effects. Hooks orchestrate the interaction between components and services.
- **services/**: Pure functions for draft analysis and improvement suggestions. No React lifecycle dependencies.
- **	ests/**: Local tests (unit, integration, or fixture-based tests) specific to the Draft Improver.
- **docs/**: Local documentation, architecture notes, and developer guides.
- **	ypes/**: TypeScript type definitions for the Draft Improver domain.

## Data Ownership

- **Local State Only:** The tool must manage its own state (e.g., using useState, useReducer, or local context) and cannot depend on the main application's global stores.
- **Data Persistence:** If local caching is required, it must use isolated browser storage keys specific to draft_improver_ to avoid conflicts with core app data.

## Dependencies

- **Internal Tools Dependencies:** Reusing shared generic utility functions from 	ools/v2/shared/ (if any) is permitted, but the tool must not depend on other individual V2 tools.
- **External Packages:** Permitted to use existing npm packages already present in the workspace package.json. Do not introduce new heavy dependencies without explicit approval.

## Integration Constraints

Contributors **MAY NOT** modify the following core systems:

- The main application shell and dashboard layout.
- The existing navigation or routing system.
- Authentication or wallet core.
- Mail rendering engine or existing inbox architecture.
- The Stellar integration core.
- Database schema.
- Existing design system components (use provided design tokens and components; do not overwrite them).

If the tool eventually requires a connection to the main mail app (e.g., to read a draft from the compose window), that integration must be handled in a **follow-up issue**. This repository contract ensures the Draft Improver remains entirely decoupled during initial development.

## Draft Improver Domain

The Draft Improver analyzes draft email content and provides actionable suggestions:

- **Clarity**: Identify wordy phrases, jargon, and complex sentences
- **Tone**: Detect aggressive, passive-aggressive, or overly formal tone
- **Structure**: Suggest paragraph breaks, bullet points, and formatting improvements
- **Completeness**: Flag missing greeting, closing, or subject line issues

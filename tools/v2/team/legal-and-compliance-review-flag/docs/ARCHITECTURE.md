# Architecture & Design Contract

## Overview
The Legal and Compliance Review Flag tool is designed as a zero-dependency, folder-isolated module within `tools/v2/team/legal-and-compliance-review-flag/`.

## Architecture Principles
1. **Side-Effect Free Core**: Business logic and input validation live in `contract.ts` as pure functions (`createReviewFlag`).
2. **Dependency Injection**: Non-deterministic capabilities (IDs, timestamps, storage, auth validation) are injected into functions via `ReviewFlagDependency`.
3. **Immutability & Auditability**: Every generated flag outcome produces an immutable, machine-readable audit trail string array.
4. **Isolated UI Component**: Presentation elements are isolated in `components/` and use native HTML form controls and inline modular styles to avoid coupling with the main application UI library or shell.

## Layer Diagram
```
+-------------------------------------------------------+
|  React UI Component (components/LegalReviewFlagForm)  |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|       React State Hook (hooks/useReviewFlag)          |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|   Service Boundary (services/review-flag-service)     |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|     Pure Execution Contract (contract.ts)             |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|   Injected Dependencies (ReviewFlagBackend / Fixtures)|
+-------------------------------------------------------+
```

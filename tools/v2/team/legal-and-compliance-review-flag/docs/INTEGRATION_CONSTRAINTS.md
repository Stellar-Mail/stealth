# Future Integration Constraints

## Boundary Isolation Rules

### 1. File & Directory Containment
All files for this tool must remain inside `tools/v2/team/legal-and-compliance-review-flag/`. Do not write files to `src/`, `contracts/`, `infra/`, or any other top-level folder.

### 2. Zero Core App Modifications
- **Routing**: Do not modify `src/routeTree.gen.ts` or add routes in `src/routes/`.
- **Navigation**: Do not add navigation sidebar links or headers in `src/components/`.
- **Global State**: Do not import from or export to global Zustand stores or TanStack Query clients in the core app.
- **Database Schema**: Do not create or edit core database migrations or D1/Prisma/SQL schemas.
- **Blockchain / Stellar**: Do not call `@stellar/stellar-sdk` or Soroban contracts directly inside this tool contract.

### 3. Integration Requirements (When Promoted to Core)
If a future issue authorizes wiring this tool into the main mail application:
- A adapter service implementing `ReviewFlagBackend` must be created in `src/services/`.
- The contract in `tools/v2/team/legal-and-compliance-review-flag/contract.ts` should be imported without modification.
- A wrapper component should bridge main app UI tokens to `LegalReviewFlagForm`.

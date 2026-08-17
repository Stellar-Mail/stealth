# Role-Based Mail Access - Module Boundaries

This document defines the internal contracts, API boundaries, and dependency rules for each module inside the Role-Based Mail Access tool.

---

## 1. Module: Guards (Validation Middleware)

**Location:** `guards/` (e.g., `guards/access-guards.mjs`)

### Responsibility

Provides the low-level security and performance validators. It throws custom `AccessValidationError` exceptions upon detecting malformed input values or bypass payloads, and acts as the gatekeeper before state mutations or policy lookups.

### Public API

```typescript
export class AccessValidationError extends Error {
  field: string;
}

export function sanitizeRole(raw: any): string | null;
export function validateRole(role: any): string;
export function validateAccessLevel(level: any): string;
export function validateEmailAddress(email: any): string;
export function validateThreadId(threadId: any): string;
export function validateAccessRequest(req: any): boolean;
export function checkAccess(role: string, accessLevel: string, policy: any): boolean;
export function guardTeamSize(members: any[]): boolean;
export function guardAttachmentCount(attachments: any[]): boolean;

export const LIMITS: {
  MAX_ROLE_LENGTH: number;
  MAX_THREAD_ID_LENGTH: number;
  MAX_EMAIL_LENGTH: number;
  MAX_TEAM_SIZE: number;
  MAX_ATTACHMENT_COUNT: number;
  ALLOWED_ROLES: string[];
  ALLOWED_ACCESS_LEVELS: string[];
};
```

### Dependencies

- No imports from `components/`, `services/`, `hooks/`, or the main application.
- Uses standard JavaScript/ESM features only.

---

## 2. Module: Services (Business Logic)

**Location:** `services/` (e.g., `services/access.service.ts`)

### Responsibility

Encapsulates state management for the active role-based permission sets and verification check logs. It interfaces directly with validation guards to process clearance checks and size limits checks.

### Public API

```typescript
export function createAccessService(initialPolicy?: AccessPolicy): {
  getPolicy: () => AccessPolicy;
  updatePolicy: (role: string, accessLevels: string[]) => void;
  getLogs: () => AccessCheckLog[];
  clearLogs: () => void;
  checkRequest: (req: VerifyAccessRequest) => {
    isAllowed: boolean;
    error?: string;
    field?: string;
  };
  checkLimits: (
    teamSize: number,
    attachmentCount: number,
  ) => {
    teamSizeValid: boolean;
    teamSizeError?: string;
    attachmentCountValid: boolean;
    attachmentCountError?: string;
  };
};
```

### Dependencies

- **Allowed to import:**
  - Guards from `../guards/`
  - TypeScript types from `../types/`
- **Forbidden:**
  - Import React or hooks directly.
  - Import presentational components.
  - Import main app stores or APIs.

---

## 3. Module: Hooks (React Context Integration)

**Location:** `hooks/` (e.g., `hooks/use-role-based-access.ts`)

### Responsibility

Synchronizes the service state with React components, managing loading visual spinners, verification status highlights, and log reset callbacks.

### Public API

```typescript
export function useRoleBasedAccess(): {
  policy: AccessPolicy;
  logs: AccessCheckLog[];
  isVerifying: boolean;
  verificationResult: {
    status: "idle" | "granted" | "denied" | "invalid";
    message?: string;
    field?: string;
  };
  updatePolicy: (role: string, accessLevels: string[]) => void;
  checkAccessRequest: (
    req: VerifyAccessRequest,
    simulateDelay: boolean,
  ) => Promise<{ isAllowed: boolean }>;
  checkTeamAndAttachmentLimits: (
    teamSize: number,
    attachmentCount: number,
  ) => LimitVerificationResult;
  resetLogs: () => void;
};
```

### Dependencies

- **Allowed to import:**
  - React hooks (`useState`, `useCallback`, `useMemo`)
  - Service factory from `../services/`
  - Types from `../types/`
- **Forbidden:**
  - Presentational components.
  - Core app state contexts.

---

## 4. Module: Components (User Interface)

**Location:** `components/`

### Responsibility

Renders the visual elements of the control plane (the Policy configuration table, the input forms, alert banners, and audit log items). Components remain presentational and delegate all verification actions and settings changes to custom hooks.

### Public API

```typescript
// PolicyMatrix.tsx
export const PolicyMatrix: React.FC<{
  policy: AccessPolicy;
  onPolicyChange: (role: string, accessLevels: string[]) => void;
}>;

// AccessVerifier.tsx
export const AccessVerifier: React.FC<{
  isVerifying: boolean;
  verificationResult: { status: string; message?: string; field?: string };
  onVerify: (req: VerifyAccessRequest, simulateDelay: boolean) => Promise<unknown>;
}>;

// AccessConsole.tsx
export const AccessConsole: React.FC;
```

### Dependencies

- **Allowed to import:**
  - Hooks from `../hooks/`
  - Types from `../types/`
  - External presentational assets (Lucide-react icons, etc.)
- **Forbidden:**
  - Importing core app features, layout navigation components, or side-effect triggers.
  - Importing service functions directly.

---

## Import Rules Checklist

When refactoring or extending this tool:

- [ ] Only import from files located inside `tools/v2/team/role-based-mail-access/`.
- [ ] Strictly maintain clean dependency boundaries: `Components ➔ Hooks ➔ Services ➔ Guards`.
- [ ] No circular dependencies.
- [ ] All shared interfaces must be imported from `types/`.

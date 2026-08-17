# Email Template Library - Module Boundaries

This document defines the internal contracts, public interfaces, and dependency rules for each module inside the Email Template Library tool. The tool is a V2, individual-audience mini-product that lets a single user create, organize, preview, and reuse email templates. It is built in isolation and is not wired into the main application yet.

---

## 1. Module: Types (Shared Contracts)

**Location:** `types/` (e.g., `types/index.ts`)

### Responsibility

Declares the shared TypeScript interfaces used across the tool. Owns no logic and imports nothing.

### Public API

```

export interface TemplateVariable {

key: string; // e.g. "firstName"

label: string; // human-readable label shown in the editor

}

export interface EmailTemplate {

id: string;

name: string;

categoryId: string | null;

subject: string;

body: string;

variables: TemplateVariable[];

}

export interface TemplateCategory {

id: string;

name: string;

}

export interface TemplateRenderResult {

subject: string;

body: string;

missingVariables: string[];

}

```

### Dependencies

- No imports from `components/`, `services/`, `hooks/`, or the main application.

---

## 2. Module: Services (Business Logic)

**Location:** `services/` (e.g., `services/template.service.ts`)

### Responsibility

Encapsulates all framework-free logic: in-memory template CRUD, validation, variable substitution, and search/sort. Services never import React and never reach outside this folder.

### Public API

```

export function createTemplateService(initialTemplates?: EmailTemplate[]): {

getTemplates: () => EmailTemplate[];

getTemplate: (id: string) => EmailTemplate | undefined;

saveTemplate: (template: EmailTemplate) => void;

deleteTemplate: (id: string) => void;

searchTemplates: (query: string) => EmailTemplate[];

renderTemplate: (

id: string,

values: Record<string, string>,

) => TemplateRenderResult;

};

```

### Dependencies

- **Allowed to import:**
  - TypeScript types from `../types/`
- **Forbidden:**
  - Import React or hooks directly.
  - Import presentational components.
  - Import main app stores or APIs.

---

## 3. Module: Hooks (React Integration)

**Location:** `hooks/` (e.g., `hooks/use-email-template-library.ts`)

### Responsibility

Synchronizes the service state with React components, managing the selected template, the edit buffer, and preview values.

### Public API

```

export function useEmailTemplateLibrary(): {

templates: EmailTemplate[];

selectedId: string | null;

select: (id: string | null) => void;

save: (template: EmailTemplate) => void;

remove: (id: string) => void;

search: (query: string) => void;

preview: (id: string, values: Record<string, string>) => TemplateRenderResult;

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

Renders the visual elements of the library (template list, editor form, and live preview). Components remain presentational and delegate all actions to the hook.

### Public API

```

// TemplateList.tsx

export const TemplateList: React.FC<{

templates: EmailTemplate[];

selectedId: string | null;

onSelect: (id: string) => void;

}>;

// TemplateEditor.tsx

export const TemplateEditor: React.FC<{

template: EmailTemplate;

onSave: (template: EmailTemplate) => void;

}>;

// TemplatePreview.tsx

export const TemplatePreview: React.FC<{

result: TemplateRenderResult;

}>;

// TemplateLibraryConsole.tsx

export const TemplateLibraryConsole: React.FC;

```

### Dependencies

- **Allowed to import:**
  - Hooks from `../hooks/`
  - Types from `../types/`
  - External presentational assets (lucide-react icons, etc.)
- **Forbidden:**
  - Importing core app features, layout navigation components, or side-effect triggers.
  - Importing service functions directly.

---

## Import Rules Checklist

When implementing or extending this tool:

- [ ] Only import from files located inside `tools/v2/individual/email-template-library/`.
- [ ] Strictly maintain clean dependency boundaries: `Components -> Hooks -> Services -> Types`.
- [ ] No circular dependencies.
- [ ] All shared interfaces must be imported from `types/`.

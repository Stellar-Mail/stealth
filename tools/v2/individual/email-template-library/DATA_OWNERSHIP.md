# Email Template Library - Data Ownership & Flow

This document details the data structures, storage parameters, state lifecycles, and mutation restrictions inside the Email Template Library tool.

---

## 1. Domain Entities & Data Model

The core structures are declared in `types/index.ts`:

```

export interface TemplateVariable {

key: string;

label: string;

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

```

---

## 2. Data Lifecycle

```

[Editor Form Input]

|  |
| --- |

v

[useEmailTemplateLibrary Hook]

|  |
| --- |

v

[TemplateService.saveTemplate() / renderTemplate()]

|  |
| --- |

v

[In-memory template collection updated]

|  |
| --- |

v

[Hook updates React state -> list and preview re-render]

```

- **Validation Checkpoint**: Every saved template runs through service validation (non-empty `id` and `name`, string `subject` and `body`, well-formed `variables`).
- **Stateless Sessions**: Templates live in in-memory service state seeded from `fixtures/` and reset on page refresh during this phase.

---

## 3. Data Storage Boundaries

- **Local RAM State only**: No database integration, blockchain sync, or cookie caching.
- **Seed Fixtures**: Initial templates come from deterministic mock data in `fixtures/`.
- **No Persistence**: If durable storage is required later, it must be added through a new adapter layer in a follow-up issue.

---

## 4. Mutability & Mutation Constraints

### Immutable

- **Fixture Vectors**: The mock templates in `fixtures/` must remain read-only at runtime.
- **Template `id`**: Once assigned, a template's `id` must never change; edits update the other fields, not the identity.

### Mutable

- **Template Collection**: Saving or deleting produces a new cloned collection rather than mutating in place.
- **Component visual state**: Local indicators such as the selected template and edit buffer.

---

## 5. Security & Privacy Safeguards

- **Fake Demo Data Only**: All sample templates and addresses are fake, deterministic, and safe for public repository review.
- **No Real Recipients or Secrets**: No real email addresses, private keys, secrets, or live network calls are ever included.
- **Safe Variable Substitution**: Rendering only substitutes declared variables and reports missing keys instead of leaking unintended data.

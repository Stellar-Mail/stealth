# Contact Extractor - Module Boundaries

This document defines the internal contracts, public interfaces, and dependency rules for each module inside the Contact Extractor tool. The tool is a V1, individual-audience mini-product that extracts structured contact details from a single email message. It is built in isolation and is not wired into the main application yet.

## 1. Module: Types (shared contracts)

Location: `types/` (for example, `types/index.ts`).

Responsibility: declares the shared TypeScript interfaces used across the tool. Owns no logic and imports nothing.

Public API:

    export interface ExtractedContact {
      id: string;
      name: string | null;
      email: string | null;
      phone: string | null;
      organization: string | null;
      source: "header" | "signature" | "body";
    }

    export interface ContactExtractionResult {
      contacts: ExtractedContact[];
      skipped: string[];
    }

    export interface ExtractionOptions {
      includeBody: boolean;
      dedupe: boolean;
    }

Dependencies: no imports from `components/`, `services/`, `hooks/`, or the main application.

## 2. Module: Services (business logic)

Location: `services/` (for example, `services/contact-extractor.service.ts`).

Responsibility: encapsulates all framework-free logic - header parsing, signature and body scanning, normalization, and de-duplication. Services never import React and never reach outside this folder.

Public API:

    export function createContactExtractorService(): {
      extract: (
        rawEmail: string,
        options?: ExtractionOptions,
      ) => ContactExtractionResult;
      dedupe: (contacts: ExtractedContact[]) => ExtractedContact[];
    };

Dependencies:

- Allowed to import: TypeScript types from `../types/`.
- Forbidden: React or hooks, presentational components, and main app stores or APIs.

## 3. Module: Hooks (React integration)

Location: `hooks/` (for example, `hooks/use-contact-extractor.ts`).

Responsibility: synchronizes the service with React components, managing the current input, the extraction result, and loading or error state.

Public API:

    export function useContactExtractor(): {
      result: ContactExtractionResult | null;
      extract: (rawEmail: string, options?: ExtractionOptions) => void;
      reset: () => void;
    };

Dependencies:

- Allowed to import: React hooks, the service factory from `../services/`, and types from `../types/`.
- Forbidden: presentational components and core app state contexts.

## 4. Module: Components (user interface)

Location: `components/`.

Responsibility: renders the visual elements of the tool (raw email input, the extract action, and the extracted contact list). Components stay presentational and delegate all actions to the hook.

Public API:

    // ContactInputPanel.tsx
    export const ContactInputPanel: React.FC<{
      onExtract: (rawEmail: string) => void;
    }>;

    // ExtractedContactList.tsx
    export const ExtractedContactList: React.FC<{
      result: ContactExtractionResult;
    }>;

    // ContactExtractorConsole.tsx
    export const ContactExtractorConsole: React.FC;

Dependencies:

- Allowed to import: hooks from `../hooks/`, types from `../types/`, and external presentational assets such as icons.
- Forbidden: core app features, layout navigation, or importing service functions directly.

## Import rules checklist

- [ ] Only import from files inside `tools/v1/individual/contact-extractor/`.
- [ ] Maintain a one-way dependency flow: components -> hooks -> services -> types.
- [ ] No circular dependencies.
- [ ] All shared interfaces are imported from `types/`.

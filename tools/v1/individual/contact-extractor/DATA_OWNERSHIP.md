# Contact Extractor - Data Ownership & Flow

This document describes the data structures, storage boundaries, state lifecycle, and mutation rules inside the Contact Extractor tool.

## 1. Domain entities and data model

The core structures are declared in `types/index.ts`:

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

## 2. Data lifecycle

- Raw email text is entered in the input panel.
- The `useContactExtractor` hook forwards it to the service.
- `ContactExtractorService.extract()` parses the text and returns a `ContactExtractionResult`.
- The hook stores the result in React state, and the contact list re-renders.

Validation checkpoint: each candidate contact is normalized and validated (well-formed email, trimmed name, recognized source) before it is added to `contacts`; anything rejected is recorded in `skipped`.

## 3. Data storage boundaries

- Local in-memory state only: no database, blockchain sync, or cookie caching.
- Seed fixtures: sample emails come from deterministic mock data in `fixtures/`.
- No persistence: durable storage, if ever required, must be added through a new adapter layer in a follow-up issue.

## 4. Mutability and mutation constraints

Immutable:

- Fixture vectors: the mock emails in `fixtures/` are read-only at runtime.
- Contact `id`: once assigned, a contact's `id` never changes.

Mutable:

- Result collection: re-running extraction produces a new result object instead of mutating the previous one in place.
- Component visual state: local indicators such as the current input buffer.

## 5. Security and privacy safeguards

- Fake demo data only: all sample emails, names, and addresses are fake, deterministic, and safe for public repository review.
- No real recipients or secrets: no real email addresses, private keys, secrets, or live network calls are ever included.
- Safe parsing: extraction only reads the provided text and never performs network lookups or enrichment.

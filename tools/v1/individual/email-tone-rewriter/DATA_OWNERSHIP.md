# Email Tone Rewriter - Data Ownership & Flow

This document describes the data structures, storage boundaries, state lifecycle, and mutation rules inside the Email Tone Rewriter tool.

## 1. Domain entities and data model

The core structures are declared in `services.ts`:

    export type SupportedTone = "concise" | "friendly" | "formal" | "apologetic";
    export type RewriteStatus = "idle" | "loading" | "success" | "error";

    export interface ToneRewriteDraft {
      subject?: string;
      bodyText: string;
      tone: SupportedTone;
      maxSentences?: number;
    }

    export interface ToneRewriteResult {
      status: RewriteStatus;
      subject: string;
      tone: SupportedTone;
      rewrittenBody: string;
      preservedKeyPoints: string[];
      sendDisabled: true;
      saveDisabled: true;
      validationErrors: string[];
    }

    export interface ToneRewriteErrorResult {
      status: "error";
      rewrittenBody: "";
      preservedKeyPoints: string[];
      sendDisabled: true;
      saveDisabled: true;
      validationErrors: string[];
    }

## 2. Data lifecycle

- A draft is entered in the input panel with `subject`, `bodyText`, `tone`, and optional `maxSentences`.
- The `useEmailToneRewriter` hook forwards it to `rewriteEmailTone`.
- `rewriteEmailTone` validates the input, extracts preserved key points, applies the tone, and returns a `ToneRewriteResult` or `ToneRewriteErrorResult`.
- The hook stores the result in React state, and the success view re-renders with the rewritten body and preserved key points.

Validation checkpoint: invalid or empty drafts are rejected with deterministic validation errors before rewriting begins.

## 3. Data storage boundaries

- Local in-memory state only: no database, blockchain sync, cookie caching, or external AI provider calls.
- Seed fixtures: sample rewrite requests and expected outputs live in `fixtures/` as deterministic mock data.
- No persistence: rewrite history is not stored outside this folder. Any durable storage must be added through a new adapter layer in a follow-up issue.

## 4. Mutability and mutation constraints

Immutable:

- Fixture vectors: mock requests and expected outputs in `fixtures/` are read-only at runtime.
- Input/output contracts: once a result is returned, its fields are not mutated by this tool.

Mutable:

- Result collection: re-running rewrite produces a new result object instead of mutating the previous one.
- Component visual state: local indicators such as `loading` or `error` flags.

## 5. Security and privacy safeguards

- Fake demo data only: all sample emails, names, and addresses are fake, deterministic, and safe for public repository review.
- No real recipients or secrets: no real email addresses, private keys, secrets, or live network calls are included.
- Safe parsing: rewriting only reads the provided text and never performs network lookups or enrichment.
- Disabled side effects: `sendDisabled` and `saveDisabled` are always `true`; this tool never sends or saves mail outside the session.
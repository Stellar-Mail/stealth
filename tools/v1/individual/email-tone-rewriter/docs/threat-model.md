# Email Tone Rewriter — Threat Model and Hardening Notes

This document records the security assumptions for the isolated Email Tone
Rewriter tool and the guards that enforce them. It covers this folder only and
does not describe the wider mail application.

## Trust boundary

- The rewriter is a pure, local, rule-based text transformer.
- It performs no network calls, reaches no mailbox or wallet state, uses no
  eval or dynamic code, and contacts no external AI provider.
- It treats all input as untrusted draft text supplied by the caller.
- It is read-only: it returns a new rewrite object and never sends, saves, or
  mutates anything. The action flags are always disabled.

## Assets to protect

- Caller-supplied draft content (must not be leaked, executed, or silently
  altered beyond the requested tone rewrite).
- Process stability and responsiveness (no unbounded work).

## Unsafe inputs and mitigations

| Unsafe input                                        | Risk                                              | Mitigation                                                               |
| --------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Oversized body or subject                           | Excessive CPU or memory, denial of service        | checkRequestLimits rejects input above hard caps before the engine runs  |
| Very high word or sentence count                    | Heavy work in key-point and length passes         | Word cap rejects early; engine passes are linear                         |
| Control characters such as NUL or BEL               | Log injection, terminal escapes, corrupted output | sanitizeText strips ASCII control chars and keeps tab and newline        |
| Zero-width or BOM characters                        | Hidden or smuggled content, spoofing              | sanitizeText strips zero-width and BOM characters                        |
| Decomposed or duplicate unicode forms               | Inconsistent matching and output                  | sanitizeText normalizes to NFC                                           |
| Non-string or missing fields                        | Type confusion, runtime errors                    | hasInspectableFields plus the engine validation return unsupported-input |
| Invalid maxWords (zero, negative, fractional, huge) | Broken truncation, wasted work                    | checkRequestLimits returns invalid-length-constraint                     |
| Unsupported tone                                    | Undefined behavior                                | Engine returns a deterministic unsupported-tone error                    |
| Empty body                                          | Meaningless work                                  | Engine returns a deterministic empty-body error                          |

## Explicitly out of scope

- HTML or markup sanitization for rendering (the rewriter outputs plain text;
  any future UI must escape on display).
- Authentication, authorization, and rate limiting (belongs to a future
  integration issue, not this folder).
- Persistence or transport security (nothing is stored or transmitted here).

## Determinism

All guards and transforms are deterministic: the same input always yields the
same result, with no randomness, clock, or locale dependence. This keeps the
behavior testable and predictable under review.

# Email Tone Rewriter — Performance Notes

Performance expectations and safeguards for the isolated Email Tone Rewriter.
Scope is this folder only.

## Cost model

For a draft body of n characters:

- Sanitization (sanitizeText): linear, a fixed set of regex passes.
- Sentence splitting and tone transforms: linear in body length.
- Key-point extraction (extractKeyPoints): linear in body length; a bounded
  number of regex passes plus one pass over the words.
- Length enforcement (enforceMaxWords): bounded by the sentence count; it only
  trims trailing sentences that carry no preserved key point.

There are no nested scans over the full body, so cost grows roughly linearly
with input size rather than quadratically.

## Hard limits

Defined in services/guards.ts as GUARD_LIMITS:

| Limit               | Default | Purpose                           |
| ------------------- | ------- | --------------------------------- |
| maxSubjectChars     | 200     | Reject runaway subject lines      |
| maxBodyChars        | 20000   | Bound total work per rewrite      |
| maxBodyWords        | 4000    | Bound word-level passes           |
| maxLengthConstraint | 2000    | Bound the optional maxWords value |

Inputs above these caps are rejected by safeRewriteEmailTone before the engine
does any rewriting work, so a hostile or accidental large payload cannot
consume meaningful CPU.

## Large emails, attachments, teams, and histories

- Large emails: capped by maxBodyChars and maxBodyWords; callers should rewrite
  one draft at a time rather than concatenating threads.
- Attachments: not read or processed by this tool; they are ignored.
- Teams or shared mailboxes: out of scope; the rewriter operates on a single
  draft and holds no shared state.
- Histories: no rewrite history is stored; each call is independent and
  stateless, so memory use stays bounded per call.

## Recommendations for a future integration

- Run safeRewriteEmailTone (not the raw engine) at any UI or API boundary so
  guards always apply.
- Debounce live preview rewrites and cancel superseded calls in the UI layer.
- Keep the caps configurable per deployment if larger drafts are ever required.

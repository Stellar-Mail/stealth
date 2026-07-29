# Performance

To avoid unnecessary work:

- subject length is capped
- body length is capped
- maximum rules are enforced
- maximum condition groups are enforced
- maximum conditions per group are enforced
- oversized regex patterns are rejected before compilation

Future improvements

- lazy evaluation
- compiled regex cache
- early exit after terminal actions
- attachment streaming

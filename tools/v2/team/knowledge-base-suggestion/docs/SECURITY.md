# Security and Performance

This document outlines the threat assumptions, unsafe input vectors, and performance constraints for the Knowledge Base Suggestion tool.

## Threat Assumptions & Unsafe Inputs

1. **Cross-Site Scripting (XSS) via Corpus Data**
   - **Assumption**: The tool searches over a `corpus` of documentation articles. Depending on where these articles are authored, the `title` and `summary` might contain untrusted input. If a consumer renders these fields directly into the DOM, XSS injection could occur.
   - **Mitigation**: The execution contract defaults to applying strict HTML escaping to the `title` and `summary` of all returned suggestions. Characters such as `<`, `>`, `&`, `"`, and `'` are safely encoded. Tags are used solely for matching and are not typically rendered, so they remain unescaped to preserve strict matching behavior.

2. **Regex Denial of Service (ReDoS) and CPU Exhaustion**
   - **Assumption**: The query tokenization process (`tokenize`) uses regex splits. An extremely large query could lead to performance degradation. Furthermore, a query generating thousands of tokens run against a large corpus would result in an expensive nested loop ($O(\text{tokens} \times \text{corpus\_size} \times \text{tags\_per\_article})$), blocking the Node.js event loop.
   - **Constraints Enforced**:
     - **Query Length**: Queries are strictly capped at 255 characters.
     - **Token Limits**: The tokenization output is truncated to a maximum of 50 terms.
     - **Corpus Limit**: The size of the `corpus` passed into the execution contract cannot exceed 10,000 articles.

## Performance Constraints

1. **Synchronous Execution Overhead**
   - **Assumption**: `suggestKb` operates synchronously to provide maximum speed for typeahead/autocomplete scenarios.
   - **Recommendation**: With the corpus limit capped at 10,000 articles, execution time remains consistently low. If future architectures require searching across >= 100,000 articles, this component should either offload scoring to an asynchronous worker or chunk the work using `setImmediate` to avoid starving the main event loop.

2. **Result Size Bounds**
   - **Assumption**: Returning thousands of suggestions consumes memory and bandwidth.
   - **Mitigation**: The `limit` property is enforced to a positive integer with a maximum of 100.

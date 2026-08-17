# Security and Performance

This document outlines the threat assumptions, unsafe input vectors, and performance constraints for the Email Template Library tool.

## Threat Assumptions & Unsafe Inputs

1. **Cross-Site Scripting (XSS)**
   - **Assumption**: Input data provided during the `render` operation (`request.values`) is fundamentally untrusted. End-users or automated systems may inject malicious HTML, JavaScript, or other web-based payloads into template variables.
   - **Mitigation**: The execution contract defaults to applying strict HTML escaping to all template variable substitutions. Characters such as `<`, `>`, `&`, `"`, and `'` are safely encoded to prevent template injection vulnerabilities when the rendered body is subsequently displayed in an email client or web UI.

2. **Template Injection & Spoofing**
   - **Assumption**: The catalog of templates (`EmailTemplate` definitions) provided to `createEmailTemplateLibraryService` is considered trusted and internal. However, the subject line and body output depend on runtime rendering.
   - **Mitigation**: Template variables are bounded. Attackers cannot declare arbitrary templates at runtime; they can only invoke registered, pre-validated templates.

## Performance Constraints

1. **Memory Exhaustion and Payload Bloat**
   - **Assumption**: Processing extremely large templates or massive substitution payloads can lead to OOM (Out-of-Memory) conditions, affecting the host node.
   - **Constraints Enforced**:
     - **Template Body Size**: Strict limit of 100 KB per template body.
     - **Subject Size**: Strict limit of 255 characters per subject line.
     - **Variable Definitions**: Maximum of 50 variables per template.
     - **Substitution Values**: Each variable value passed to the `render` operation is capped at 10 KB.

2. **Regular Expression Denial of Service (ReDoS)**
   - **Assumption**: The substitution engine uses regular expressions to find placeholder tags (e.g. `{{ variable }}`). Maliciously large strings combined with heavy regex lookups could cause the event loop to hang.
   - **Mitigation**: The regex used for extraction `\{\{\s*([\w.-]+)\s*\}\}` is inherently simple and non-backtracking. Furthermore, enforcing the 100 KB max template body limit bounds the total search space tightly, avoiding long-running evaluation times.

3. **Batch Execution (Teams / Histories)**
   - **Assumption**: Some clients may invoke the library in loops to render emails for large teams or historical data.
   - **Recommendation**: The service execution is synchronous and fast per-call. For bulk rendering (e.g. >1,000 templates), consumers should yield to the event loop between batches or offload rendering to background workers, since synchronous CPU-bound loops can block Node's main thread.

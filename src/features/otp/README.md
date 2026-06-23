# OTP Detection Module

## Overview

This module provides automatic detection and display of one-time passwords (OTPs) and verification codes in email message bodies. It is designed to improve the user experience when handling security-sensitive authentication flows.

## Module Structure

### Files

- **`detectOtp.ts`** - Core OTP detection logic (pattern matching)
- **`components/OTPCard.tsx`** - UI component for displaying detected codes
- **`styles.css`** - Visual styling for OTP card and scene
- **`index.ts`** - Public API exports

### Integration Point

- **`src/components/mail/EmailView.tsx`** (lines 306-309) - Renders `OTPCard` when `detectOtp()` returns a code

## Data Contracts

### `detectOtp(body: string): string | null`

**Input:**

- `body`: Plain text email message body (no HTML)

**Output:**

- Returns a numeric string of 4-8 digits if a code is detected
- Returns `null` if no code is found

**Detection Strategy:**

1. **Keyword-based**: Searches for keywords (`otp`, `one-time password`, `passkey`, `verification code`, `security code`, `code`, `pin`) followed by 4-8 digits within 40 characters
2. **Standalone**: Detects 6-digit codes on their own line (fallback pattern)

**Example Matches:**

```
"Your verification code is: 123456"  → "123456"
"OTP: 1234"                          → "1234"
"Security code 12345678"             → "12345678"
"\n  654321\n"                       → "654321"
```

**Non-Matches:**

- Codes with fewer than 4 or more than 8 digits
- Numeric strings without security-related keywords (unless standalone 6-digit)
- HTML tags or structured content (requires plain text input)

### `OTPCard` Component

**Props:**

```typescript
{
  code: string;
} // Must be 4-8 digit numeric string
```

**Behavior:**

- Splits code into individual digits for display
- Provides one-click copy to clipboard via `navigator.clipboard.writeText()`
- Shows visual "Copied" confirmation for 1.6 seconds
- Animated entry with motion effects (framer-motion)

**User-Facing States:**

1. **Default**: "Copy code" button with copy icon
2. **Copied**: "Copied" button with check icon (1600ms duration)
3. **Error**: Silent failure if clipboard API unavailable (noop)

## Safety & Privacy Boundaries

### What This Module Does

- ✅ Scans **plain text email body** for OTP patterns
- ✅ Displays codes in a visually distinct, secure-looking UI
- ✅ Copies codes to system clipboard on user action
- ✅ Auto-detects codes without user configuration

### What This Module Does NOT Do

- ❌ Does not send codes to external services
- ❌ Does not store codes in browser storage or database
- ❌ Does not auto-fill codes into external forms
- ❌ Does not validate code expiry (display only)
- ❌ Does not handle HTML email parsing (requires plain text)

### Privacy & Trust Assumptions

1. **Local Processing Only**: All detection runs client-side in the browser. No codes are transmitted.

2. **No Persistence**: Codes are not stored. They exist only in:
   - Component state during render
   - System clipboard after user copies (clipboard is managed by the OS)

3. **User Control**: Copy action requires explicit user click. No auto-copy behavior.

4. **False Positives**: The detection logic prioritizes recall over precision. Non-OTP numeric sequences may be detected if they match patterns. This is acceptable for the current use case.

5. **Keyword Dependency**: Detection relies on English keywords. Non-English OTPs may not be detected unless they use standalone 6-digit format.

### Security-Sensitive Behavior

⚠️ **Clipboard Access**: The module uses `navigator.clipboard.writeText()` which requires:

- HTTPS or localhost context
- User permission (browser-managed)
- User gesture (click event)

⚠️ **Trust Model**: The module assumes email bodies are already validated/sanitized by the time they reach this module. Input validation is the caller's responsibility.

⚠️ **Demo Data Only**: For testing, use fake codes like `123456`, `000000`, or `999999`. **Never use real customer codes or live authentication secrets in test files or demos.**

## Contributor Checklist

### Before Modifying Detection Logic (`detectOtp.ts`)

- [ ] Understand the two detection patterns (keyword + standalone)
- [ ] Test with fake codes only (never real user data)
- [ ] Verify changes don't break existing OTP formats (see examples above)
- [ ] Consider false positive rate vs. false negative rate tradeoffs

### Before Modifying UI (`OTPCard.tsx` or `styles.css`)

- [ ] Test copy behavior in HTTPS and localhost contexts
- [ ] Verify clipboard permission handling
- [ ] Ensure "Copied" state transitions smoothly (1600ms duration)
- [ ] Check responsive behavior at mobile/tablet/desktop sizes
- [ ] Validate accessibility (keyboard navigation, ARIA labels if needed)

### Before Modifying Integration (`EmailView.tsx`)

- [ ] Verify OTPCard only renders when `detectOtp()` returns non-null
- [ ] Test with various email body formats (empty, no OTP, multiple codes)
- [ ] Ensure module has no side effects on other email rendering features

## QA Checklist

### Functional Testing

1. **Detection Accuracy**
   - [ ] Detects 4-digit code: "Your code is 1234"
   - [ ] Detects 6-digit code: "OTP: 123456"
   - [ ] Detects 8-digit code: "Verification code 12345678"
   - [ ] Detects standalone: "\n 654321\n"
   - [ ] Does not detect 3-digit: "Code 123"
   - [ ] Does not detect 9-digit: "Code 123456789"
   - [ ] Does not detect non-OTP numbers: "Your order #123456"

2. **Copy Behavior**
   - [ ] Click "Copy code" → Code is in clipboard
   - [ ] Button shows "Copied" with check icon
   - [ ] "Copied" state reverts after ~1.6 seconds
   - [ ] Successive copies work correctly
   - [ ] Copy fails gracefully in non-HTTPS context (if applicable)

3. **Visual States**
   - [ ] Card renders with proper spacing and shadows
   - [ ] Digits are clearly separated and readable
   - [ ] Padlock icon displays correctly
   - [ ] Entry animation plays smoothly (no jank)
   - [ ] Button hover/active states work

4. **Edge Cases**
   - [ ] Empty email body → No card rendered
   - [ ] Email with multiple codes → Only first code detected
   - [ ] Code with spaces/hyphens: "123-456" → Normalizes to "123456"
   - [ ] Very long email body → Detection completes without lag

### Browser Compatibility

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (macOS/iOS)
- [ ] Mobile browsers (iOS Safari, Chrome Android)

### Regression Testing

- [ ] OTPCard does not interfere with calendar event rendering
- [ ] OTPCard does not interfere with sender conversion UI
- [ ] OTPCard does not break email layout on narrow viewports

## Testing Commands

```bash
# Type checking
bun x tsc --noEmit

# Linting
bun run lint

# Unit tests (if applicable)
bun test src/features/otp

# E2E tests (if OTP scenarios exist)
bun run test:e2e
```

## Related Files

- Integration: `src/components/mail/EmailView.tsx`
- Calendar feature (sibling): `src/features/calendar`
- Sender conversion (sibling): `src/features/sender-conversion`

## Future Considerations

**Out of Scope for This Module:**

- Multi-language keyword support
- OTP expiry countdown timers
- Auto-fill into external forms
- Storing OTP history
- Integration with password managers
- Backend OTP validation

**If You Need These Features:**

- Propose them as separate issues with clear security/privacy analysis
- Consider whether they belong in this module or a new feature
- Document trust boundaries before implementation

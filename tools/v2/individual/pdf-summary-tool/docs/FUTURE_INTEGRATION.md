# PDF Summary Tool - Future Integration Plan

This document outlines how the PDF Summary Tool will integrate with the main application when it's ready (in a separate, future issue).

## Current State

**Status:** Isolated, not integrated  
**Location:** `tools/v2/individual/pdf-summary-tool/`  
**Integration:** None (tool works standalone)

## Integration Roadmap

### Phase 1: Current Development (This Issue)

✅ Build isolated tool  
✅ Create architecture contract  
✅ Document module boundaries  
✅ Establish data ownership

**Outcome:** Self-contained mini-product ready for use or integration

---

### Phase 2: Future Integration (Separate Issue)

When the PDF Summary Tool is ready to integrate with the main app, a **separate issue** will be created with:

#### 2.1 Integration Layer

Create new feature in main app:

```
src/features/pdf-summary-integration/
├── PDFSummaryWidget.tsx          # Main integration component
├── usePDFSummaryIntegration.ts   # Integration hook
├── types.ts                       # Integration types
└── index.ts                       # Exports
```

#### 2.2 Email Composer Integration

Add PDF summarization to compose view:

```typescript
// In src/features/compose/ComposeArea.tsx

import { PDFSummaryWidget } from '../pdf-summary-integration';

export const ComposeArea = () => {
  return (
    <div>
      {/* Existing compose UI */}
      <PDFSummaryWidget onSummaryInsert={insertIntoBody} />
    </div>
  );
};
```

#### 2.3 Mail Attachment Detection

Detect PDFs in mail attachments:

```typescript
// In src/features/mail/AttachmentHandler.tsx

import { canSummarize } from '../../../tools/v2/individual/pdf-summary-tool/utils/pdfValidation';

export const AttachmentHandler = ({ attachment }) => {
  if (canSummarize(attachment.file)) {
    return <OfferSummarization attachment={attachment} />;
  }
  return <DefaultAttachmentUI attachment={attachment} />;
};
```

---

## Integration Points

### 1. Compose Integration

**What:** User can summarize PDF attachments while composing email

**Flow:**

```
User attaches PDF
  ↓
System detects PDF
  ↓
Shows "Summarize" button
  ↓
User clicks "Summarize"
  ↓
PDF Summary Tool generates summary
  ↓
Insert summary into compose body
  ↓
User can edit/send
```

**Location:** `src/features/compose/`  
**Integration Type:** UI widget  
**Data Flow:** Attachment → Tool → Compose body

### 2. Mail Reading Integration

**What:** Show summary of PDF attachments in mail view

**Flow:**

```
User opens mail with PDF attachment
  ↓
System detects PDF
  ↓
Shows "View Summary" option
  ↓
User clicks option
  ↓
PDF Summary Tool generates/shows summary
  ↓
Display in attachment view
```

**Location:** `src/features/mail/`  
**Integration Type:** UI section  
**Data Flow:** Attachment → Tool → Display

### 3. Attachment Toolbar Integration

**What:** Quick summarize button in attachment toolbar

**Location:** `src/components/mail/`  
**Integration Type:** Toolbar button  
**Data Flow:** Attachment → Tool → Modal/Popup

---

## Data Flow at Integration

### Before Integration (Current)

```
Tool (Local)
  ↓
User's PDFs (In Browser)
  ↓
Tool's localStorage (Local)
  └─ No connection to main app
```

### After Integration (Future)

```
Main App
  ├─ User Authentication
  ├─ Mail System
  │   └─ Attachments
  │       └─ PDF file
  │
  └─→ PDF Summary Tool
      ├─ Extract text
      ├─ Generate summary
      ├─ (Optional) Store in user's account
      └─→ Return summary

  └─→ Insert into Compose / Display in Mail View
```

---

## API for Integration

### Wrapper Component (to be created)

```typescript
// src/features/pdf-summary-integration/PDFSummaryWidget.tsx

interface PDFSummaryWidgetProps {
  // Input
  file: File;
  onSummaryGenerated?: (summary: string) => void;
  onError?: (error: Error) => void;

  // UI
  triggerLabel?: string;
  className?: string;
}

export const PDFSummaryWidget: React.FC<PDFSummaryWidgetProps> = ({
  file,
  onSummaryGenerated,
  onError,
  triggerLabel = "Summarize PDF",
  className,
}) => {
  // Uses PDF Summary Tool internally
  // Re-exports as simple component for main app
};
```

### Integration Hook (to be created)

```typescript
// src/features/pdf-summary-integration/usePDFSummaryIntegration.ts

interface UsePDFSummaryIntegrationOptions {
  onSuccess?: (summary: string) => void;
  onError?: (error: Error) => void;
}

export function usePDFSummaryIntegration(
  options?: UsePDFSummaryIntegrationOptions
) {
  return {
    summarizeAttachment: async (file: File) => string,
    isLoading: boolean,
    error?: Error,
  };
}
```

---

## Database Considerations

### Current (Local Only)

- Summaries stored in browser localStorage
- No server-side persistence
- No user account association

### Future Options (To Decide in Integration Issue)

#### Option A: Keep Local Only

- Summaries stay in browser only
- No server storage
- No sync across devices
- Simple, minimal changes

#### Option B: Add Server Sync

- Summaries synced to user's account
- Available across devices
- Searchable in mail
- Requires database schema changes

#### Option C: Hybrid

- Local cache for performance
- Optional sync to server
- Best of both worlds
- More complex implementation

**Decision:** To be made in the integration issue based on:

- User needs
- Privacy considerations
- Performance requirements
- Storage costs

---

## Authentication Integration

### Current (No Auth)

- Tool works for any user
- No account-specific data
- No authentication needed

### Future (If Needed)

- Use existing auth system: `useAuth()` hook
- Associate summaries with user ID
- Include in user data export/delete

**Constraint:** Must use main app's existing auth, not create separate auth.

---

## Wallet/Blockchain Integration

### Current

- Zero blockchain interaction
- No wallet access needed

### Future

- Remains the same (no planned changes)
- Tool doesn't need wallet/blockchain data
- Tool doesn't require transactions
- Completely independent of Stellar core

---

## Testing Integration

### Unit Tests (No Changes)

- Tool tests remain local: `tools/v2/individual/pdf-summary-tool/tests/`
- Main app tests remain separate: `tests/unit/`

### Integration Tests (New)

```
tests/integration/
├── pdf-summary-integration/
│   ├── compose-integration.spec.ts
│   ├── mail-attachment-detection.spec.ts
│   └── toolbar-integration.spec.ts
```

### E2E Tests (New)

```
tests/e2e/
├── pdf-summary-compose.spec.ts
├── pdf-summary-mail.spec.ts
└── pdf-summary-attachment.spec.ts
```

---

## Deployment Considerations

### Rollout Plan

1. **Phase 1:** Deploy tool in isolation (current)
2. **Phase 2:** Deploy integration layer with feature flag
3. **Phase 3:** Enable for subset of users (beta)
4. **Phase 4:** Roll out to all users

### Feature Flag

```typescript
// src/features/pdf-summary-integration/useFeatureFlag.ts

export function usePDFSummaryFeatureEnabled(): boolean {
  // Check if feature is enabled for current user
  // Uses main app's feature flag system
}
```

### Backwards Compatibility

- Main app must not break without tool
- Tool must be optional
- Graceful degradation if tool unavailable
- No hard dependency on tool

---

## Breaking Changes Prevention

### Current Tool Changes Won't Break Main App

- Tool is isolated
- Main app doesn't import from tool
- No shared state or context
- Safe to modify tool without affecting main app

### When Integrating

- Must use semantic versioning
- Document API contract
- Use deprecation periods for API changes
- Provide migration guides

---

## Success Criteria for Integration Issue

When it's time to integrate, the issue should include:

- [ ] Integration feature documented
- [ ] Wrapper components created
- [ ] Integration hooks defined
- [ ] Main app integration points identified
- [ ] Data sync strategy decided (if applicable)
- [ ] Database schema changes (if needed)
- [ ] Auth integration planned
- [ ] Tests written
- [ ] E2E tests pass
- [ ] Performance acceptable
- [ ] Feature flag implemented
- [ ] Rollout plan documented

---

## Questions About Integration?

This is a **future document**. The decisions here are preliminary and will be refined when the integration issue is created.

Key people to involve in integration:

- Product: Confirm integration requirements
- Backend: Database and API design
- Design: UX for integration points
- QA: Testing strategy
- DevOps: Deployment and rollout

---

## Related Issues

- **Current:** PDF Summary Tool - Architecture (this issue)
- **Next:** PDF Summary Tool - Integration (future issue)

---

## Do Not Edit

This section is reserved for integration issue maintainers.

**Integration Issue #:** (TBD)  
**Assigned to:** (TBD)  
**Integration Status:** Not started  
**Expected Integration Date:** (TBD)

# PDF Summary Tool - Data Ownership & Flow

This document defines how data flows through the PDF Summary Tool and who owns each piece of data.

## Data Model

### Core Entities

```typescript
interface PDF {
  id: string; // Generated from file
  name: string; // Filename
  size: number; // File size in bytes
  uploadedAt: Date; // When user selected file
  content?: string; // Extracted text (temporary)
}

interface Summary {
  id: string; // Generated on creation
  pdfId: string; // Reference to PDF
  content: string; // Summary text
  settings: SummarySettings; // Settings used to generate
  generatedAt: Date; // When summary was created
}

interface SummarySettings {
  length: "short" | "medium" | "long";
  style: "bullet-points" | "paragraph";
  includeKeywords: boolean;
  language: string;
}
```

---

## Data Lifecycle

### Phase 1: User Uploads PDF

```
User selects PDF file
    ↓
PDFUploadZone component receives File object
    ↓
validatePDFFile() util checks size & type
    ↓
usePDFSummary hook is triggered
    ↓
File stays in browser memory
```

**Ownership:** User's browser (in-memory)  
**Data:** File object (not persisted)  
**Service:** None yet

### Phase 2: Extract Text from PDF

```
usePDFSummary hook calls extractText()
    ↓
pdfProcessing service uses PDF.js
    ↓
Reads file as ArrayBuffer
    ↓
PDF.js parses and extracts text
    ↓
Returns plain string text
```

**Ownership:** Browser memory  
**Data:** Extracted text string (temporary, discarded after summarization)  
**Service:** `pdfProcessing.extractText()`  
**Constraint:** Text is NOT persisted to storage; only held in memory during processing

### Phase 3: Generate Summary

```
usePDFSummary hook calls generateSummary()
    ↓
summarization service processes text
    ↓
Applies settings (length, style, etc.)
    ↓
Generates summary
    ↓
Returns summary string
```

**Ownership:** Browser memory  
**Data:** Summary text string  
**Service:** `summarization.generateSummary()`  
**Constraint:** Summary generation is local only; no external API calls (unless explicitly added in future)

### Phase 4: Persist Summary

```
usePDFSummary hook creates Summary object
    ↓
Hook calls storage.saveSummary()
    ↓
storage service serializes to JSON
    ↓
localStorage writes to browser storage
    ↓
Persisted under key: "pdf-summary-tool:summaries"
```

**Ownership:** Browser localStorage  
**Data:** Summary object (JSON serialized)  
**Service:** `storage.saveSummary()`  
**Constraint:** Only summaries are persisted, not original PDFs

### Phase 5: Display Summary

```
SummaryDisplay component receives Summary from hook
    ↓
Component renders summary content
    ↓
User can copy or download summary
```

**Ownership:** Browser memory  
**Data:** Displayed to user only  
**Service:** None (read-only phase)

---

## Storage Ownership

### What Gets Stored

✅ **Persisted to localStorage:**

- Summary objects (with ID, content, settings, timestamp)
- Summary settings preferences
- User's last used summary settings

❌ **NOT persisted:**

- Original PDF files
- Extracted text (only kept in memory during processing)
- Temporary processing state
- User's authentication token
- Main app data

### Storage Schema

```typescript
// localStorage key: "pdf-summary-tool:summaries"
type StoredSummaries = Summary[];

// localStorage key: "pdf-summary-tool:settings"
type StoredSettings = SummarySettings;

interface StorageData {
  summaries: Summary[]; // All summaries created by user
  settings: SummarySettings; // User's preferred settings
}
```

### Storage Constraints

- **No network sync:** Data stays in browser only
- **Unencrypted:** Subject to browser's same-origin policy
- **Max size:** Browser localStorage typically 5-10MB
- **Persistence:** Survives browser restart, deleted on clear cache
- **Isolation:** Tool's data isolated from main app via key prefix
- **No access from main app:** Main app cannot read this tool's localStorage keys

---

## Data Ownership Map

| Data              | Owner            | Location     | Service                 | Constraint          |
| ----------------- | ---------------- | ------------ | ----------------------- | ------------------- |
| Original PDF file | User's browser   | Memory       | None                    | Not persisted       |
| Extracted text    | Browser memory   | RAM          | `pdfProcessing`         | Discarded after use |
| Summary content   | User (persisted) | localStorage | `storage.saveSummary()` | JSON serialized     |
| Summary settings  | User (persisted) | localStorage | `storage.saveSummary()` | JSON serialized     |
| PDF metadata      | None             | Memory       | None                    | Discarded           |
| User preferences  | User (persisted) | localStorage | Hook state              | JSON serialized     |

---

## Data Flow Diagram

```
┌─────────────────┐
│  User Browser   │
│  (Client)       │
└────────┬────────┘
         │
         ├─ User selects PDF
         │
         ├─→ [PDFUploadZone Component]
         │
         ├─→ [usePDFSummary Hook]
         │   ├─ Call extractText()
         │   ├─ Call generateSummary()
         │   └─ Call saveSummary()
         │
         ├─→ [pdfProcessing Service]
         │   ├─ Extract text from PDF
         │   └─ Validate PDF
         │
         ├─→ [summarization Service]
         │   └─ Generate summary
         │
         ├─→ [storage Service]
         │   ├─ Save to localStorage
         │   └─ Read from localStorage
         │
         └─→ [localStorage]
             └─ JSON serialized summaries
```

---

## Who Can Access Data

### Within Tool

- ✅ Components can read data from hooks (props only)
- ✅ Hooks can read data from services
- ✅ Services can read data from localStorage
- ✅ Tests can mock and read all data

### Outside Tool

- ❌ Main app cannot read tool's localStorage
- ❌ Main app cannot access tool's services
- ❌ Main app cannot access tool's hooks
- ❌ Tool cannot read main app's data

### User

- ✅ Can view summaries in UI
- ✅ Can copy summary text
- ✅ Can download summary
- ✅ Can change settings
- ✅ Can delete summaries (via future feature)
- ✅ Can clear browser cache to delete all data

---

## Data Mutability

### Immutable Data

- 📌 Summary objects (created once, not modified)
- 📌 PDF metadata
- 📌 Timestamps

### Mutable Data

- 🔄 User settings (can change at any time)
- 🔄 Summary list (additions/deletions)
- 🔄 Component state

### Mutation Rules

- ✅ Services return new objects, don't mutate params
- ✅ Hooks use useState for mutations
- ✅ localStorage updates always replace entire key
- ❌ Never mutate function parameters
- ❌ Never mutate Summary objects after creation

---

## Data Security Considerations

### Current State (Isolated Tool)

- ✅ All data stays in browser
- ✅ No network transmission
- ✅ No server storage
- ✅ User controls all data (local browser only)
- ✅ Respects browser same-origin policy

### Future Considerations (When Integrated)

When this tool integrates with the main app (in a separate issue), consider:

- 🔐 Whether to sync summaries to server
- 🔐 Whether to associate with user account
- 🔐 Whether to encrypt sensitive summaries
- 🔐 Whether to set retention policies
- 🔐 Whether to sync across devices

These decisions should be made in the integration issue, not here.

---

## Data Validation

### Input Validation

- ✅ `validatePDFFile()` checks file type and size
- ✅ Services validate all parameters
- ✅ Hooks validate before calling services
- ✅ Components validate before passing to hooks

### Output Validation

- ✅ Services return typed results
- ✅ Hooks return validated state
- ✅ Components trust hook return types
- ✅ localStorage serialization validates data shape

### Validation Constraints

- ❌ Don't skip validation for "trusted" data
- ❌ Don't assume file size without validation
- ❌ Don't assume PDF content is parseable
- ❌ Don't assume localStorage is always available

---

## Data Cleanup

### Automatic Cleanup

- ✅ Extracted text discarded after summarization
- ✅ Processing errors cleared on success
- ✅ Component state cleaned on unmount

### Manual Cleanup

- ✅ User can delete individual summaries (future feature)
- ✅ User can clear all summaries (future feature)
- ✅ User can clear browser cache to wipe all data

### What Should NOT Happen

- ❌ Don't log user's PDF content
- ❌ Don't send data to external services without user consent
- ❌ Don't persist data outside of localStorage
- ❌ Don't sync data to main app without integration issue

---

## Storage Keys Reference

```typescript
// All storage keys used by this tool:
const STORAGE_KEYS = {
  summaries: "pdf-summary-tool:summaries", // Summary[]
  settings: "pdf-summary-tool:settings", // SummarySettings
  // Add any future keys here with explanation
};
```

**Important:** All keys must be prefixed with `pdf-summary-tool:` to avoid collisions with main app or other tools.

---

## Future Integration Points

When integrating with main app (separate issue), you might add:

1. **Server-side storage** - Sync summaries to user's account
   - Document: New storage service that talks to main app API
   - Add: New storage key for sync status tracking

2. **Email integration** - Send summary in compose view
   - Document: Data flow from compose to summarization
   - Add: New hook to bridge contexts

3. **Mail attachment detection** - Auto-detect PDFs in attachments
   - Document: How tool receives attachment context
   - Add: New hook for attachment integration

These are **NOT part of this issue**. They belong in separate integration issues.

See [docs/FUTURE_INTEGRATION.md](./docs/FUTURE_INTEGRATION.md) for the integration roadmap.

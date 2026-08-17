# PDF Summary Tool - Specifications

## Product Overview

The PDF Summary Tool enables users to automatically generate summaries from PDF documents. Users can configure summary length, style, and language preferences. Summaries are generated locally in the browser and can be stored for later retrieval.

## Scope

- **Release Tier:** V2 Later
- **Audience:** Individual Users
- **Folder Ownership:** `tools/v2/individual/pdf-summary-tool/`

This is a **self-contained mini-product**. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a separate integration issue explicitly allows it.

## Core Features

### 1. PDF Upload & Processing

- Accept PDF files from user via drag-and-drop or file selector
- Validate PDF files (size, format)
- Extract text content from PDF
- Display progress and error messages

**Constraints:**

- Maximum file size: 50MB
- Only PDF format allowed
- No server upload (local processing only)

### 2. Summary Generation

- Generate summaries from extracted text
- Support configurable summary length: short, medium, long
- Support output formats: bullet-points, paragraph
- Optional keyword extraction
- Support multiple languages (starting with English)

**Constraints:**

- All processing local in browser
- No external API calls (unless added in future integration)
- Deterministic output for same input

### 3. Configuration & Preferences

- Allow users to set preferred summary length
- Allow users to set preferred output style
- Allow users to enable/disable keyword extraction
- Persist settings in browser localStorage
- Remember settings across sessions

### 4. Storage & Retrieval

- Persist generated summaries to browser localStorage
- Retrieve previously generated summaries
- Display list of saved summaries
- Delete individual summaries (future feature)
- Automatic cleanup of old summaries (future feature)

**Constraints:**

- All storage is local (browser only)
- Subject to localStorage size limits (~5-10MB)
- Data cleared when user clears browser cache
- No sync to server (future decision)

### 5. User Interface

- Clean, intuitive interface for PDF upload
- Display extracted text with length info
- Display generated summary in readable format
- Show error messages clearly
- Display processing progress/loading states
- Responsive design for different screen sizes

**Constraints:**

- Use existing Radix UI components
- Don't modify main app design system
- Keep local styling only
- Accessible per WCAG guidelines

## Non-Features

❌ **Out of Scope for V2 Later:**

- Email integration (separate integration issue)
- Server-side summarization
- Sharing summaries
- Exporting to different formats
- Real-time collaboration
- Database storage
- User accounts (not needed for local tool)
- Authentication (not needed for local tool)
- Advanced NLP/ML features
- Multi-file batch processing

These features belong in future issues or integration proposals.

## Technical Architecture

- **Location:** `tools/v2/individual/pdf-summary-tool/`
- **Structure:** Components, Services, Hooks, Types, Utils, Tests, Docs, Config
- **Technology:** React, TypeScript, Vitest, PDF.js
- **Storage:** Browser localStorage only
- **State Management:** React hooks (useState, useEffect)
- **Styling:** CSS modules or Tailwind (local only)
- **Testing:** Unit, integration, E2E tests (local only)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete architecture.

## Data Model

### PDF

```typescript
{
  id: string;              // File identifier
  name: string;            // Filename
  size: number;            // File size in bytes
  uploadedAt: Date;        // Upload timestamp
  content?: string;        // Extracted text
}
```

### Summary

```typescript
{
  id: string; // Summary ID
  pdfId: string; // Reference to source PDF
  content: string; // Summary text
  settings: SummarySettings; // Generation settings
  generatedAt: Date; // Creation timestamp
}
```

### SummarySettings

```typescript
{
  length: "short" | "medium" | "long";
  style: "bullet-points" | "paragraph";
  includeKeywords: boolean;
  language: string;
}
```

## Success Criteria

✅ **Acceptance Criteria:**

1. ✅ Tool has clear folder-local architecture plan documented
2. ✅ Module boundaries clearly defined (components, services, hooks, types, utils)
3. ✅ Data ownership documented (what gets stored, where, how)
4. ✅ Integration constraints explicitly stated
5. ✅ No modifications to main app shell, routing, or core systems
6. ✅ All files contained within `tools/v2/individual/pdf-summary-tool/`
7. ✅ Architecture is self-contained and reviewable
8. ✅ Contributors understand what can and cannot be changed
9. ✅ Future integration path is documented (but not implemented)
10. ✅ Contributing guidelines are clear

## Folder Structure

```
tools/v2/individual/pdf-summary-tool/
├── ARCHITECTURE.md                    # Architecture specification
├── CONTRIBUTOR_GUIDE.md               # How to contribute
├── DATA_OWNERSHIP.md                  # Data flow documentation
├── INTEGRATION_CONSTRAINTS.md         # Hard boundaries
├── MODULE_BOUNDARIES.md               # Module contracts
├── README.md                          # Quick start
├── specs.md                           # This file
│
├── components/                        # React components
├── services/                          # Business logic
├── hooks/                            # React hooks
├── types/                            # TypeScript definitions
├── utils/                            # Pure utilities
├── config/                           # Configuration
│
├── tests/                            # Test suite
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── fixtures/                         # Test data
├── docs/                             # Local documentation
│   ├── README.md
│   ├── API.md
│   ├── DEVELOPMENT.md
│   └── FUTURE_INTEGRATION.md
└── [placeholder files]               # Example implementations
```

## Contribution Guidelines

See [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md) for detailed guidelines on:

- Setting up development environment
- Code style and patterns
- Module responsibilities
- Testing requirements
- PR submission process
- Common mistakes to avoid

## Issue Categories

Work on this tool should be organized into these categories:

- **Architecture** - Design and structure issues
- **Feature** - New functionality and capabilities
- **UI and Accessibility** - User interface and accessibility improvements
- **Security and Performance** - Security hardening and optimization
- **Testing and Documentation** - Tests, docs, and examples
- **Bug Fix** - Defect fixes

## Definition of Done

A feature is done when:

1. ✅ Code is written following module patterns
2. ✅ Tests pass (unit and integration)
3. ✅ Code is linted and formatted
4. ✅ Documentation is updated
5. ✅ Types are defined and exported
6. ✅ No imports from main app
7. ✅ No modifications outside tool boundary
8. ✅ PR is reviewed and approved
9. ✅ Changes are committed to main branch

## Future Integration

Integration with the main application is planned but will be handled in a **separate issue**.

When integrating:

- Tool remains isolated during development
- Integration layer created in main app
- No changes to tool's core architecture
- Feature flags used for gradual rollout
- Backward compatibility maintained

See [docs/FUTURE_INTEGRATION.md](./docs/FUTURE_INTEGRATION.md) for integration planning.

## Dependencies

### Runtime Dependencies

- React (already in main app)
- TypeScript (already in main app)
- Radix UI (already in main app, for components only)
- PDF.js (may need to add to package.json)
- Native browser APIs (File, Blob, localStorage)

### Development Dependencies

- Vitest (already in main app)
- React Testing Library (already in main app)
- TypeScript compiler (already in main app)

## Maintenance & Support

**Owner:** TBD  
**Reviewers:** TBD  
**Issues:** Use GitHub issues with appropriate labels  
**Discussions:** Use GitHub discussions for design decisions

## References

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Full architecture
- [MODULE_BOUNDARIES.md](./MODULE_BOUNDARIES.md) - Module contracts
- [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) - Data flow
- [INTEGRATION_CONSTRAINTS.md](./INTEGRATION_CONSTRAINTS.md) - Constraints
- [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md) - Contributing
- [docs/API.md](./docs/API.md) - API reference
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Dev setup
- [docs/FUTURE_INTEGRATION.md](./docs/FUTURE_INTEGRATION.md) - Integration roadmap

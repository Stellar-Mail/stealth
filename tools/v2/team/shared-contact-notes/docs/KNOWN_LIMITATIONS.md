# Shared Contact Notes — Known Limitations

This document describes the current limitations of the Shared Contact Notes tool and planned future integrations.

## Current Implementation Scope

The Shared Contact Notes tool is a **V2 later-release tool** — it is a complete, isolated, and testable implementation of the core business logic and UI, but it is not yet integrated with the main application.

## Known Limitations

### Storage & Persistence

**Limitation:** In-memory only, no persistence layer.

- Notes are stored in an in-memory `Map` and are lost when the service is destroyed.
- No data survives application reload or server restart.
- No synchronization with external storage (database, API, localStorage).

**Workaround for Development:**

- Use test fixtures (`fixtures/notes.ts`) for deterministic seed data
- For demo/UI development, consider a future persistence layer issue

**Future Resolution:** A follow-up issue will add persistence (e.g., localStorage for client-side, API/database for server).

---

### Authentication & Authorization

**Limitation:** No authentication or authorization checks.

- Any caller can perform any operation without credentials.
- Author attribution (`authorId` field) is user-provided, not validated against an authentication system.
- No ownership checks — any user can modify or delete any note.
- No role-based access control (e.g., "only team leads can delete notes").

**Workaround:** The `authorId` field can be used by UI layers to display author attribution and implement UI-level permission checks (e.g., disable delete button if not author).

**Future Resolution:** A follow-up issue will integrate with the main app's authentication system and add authorization middleware to the service.

---

### Integration with Main App

**Limitation:** No integration with the main application.

- The tool does not connect to the main app's contact models, routing, or shell.
- No navigation from the contact detail panel to the notes feature.
- No integration with the main inbox, mail rendering, or dashboard.
- The UI components are self-contained and do not render within the main app layout.

**Reason:** This is an isolated **later-release tool**. Integration is intentionally deferred to a separate issue to keep the initial implementation small and testable.

**Future Resolution:** A follow-up "Integration Issue" will:

- Add the tool to the main app's routing (`src/routes/`)
- Render the UI component in the contact detail panel
- Connect to the main app's contact models and services
- Integrate with app-wide authentication and styling

---

### Real-Time Collaboration

**Limitation:** No multi-user awareness or real-time collaboration.

- No real-time sync between multiple users viewing/editing the same note.
- No presence indicators (e.g., "User X is editing this note").
- No conflict resolution if two users edit a note simultaneously.
- Concurrent edits will overwrite each other (last-write-wins).

**Workaround:** UI layers can implement optimistic updates and conflict resolution strategies locally.

**Future Resolution:** A follow-up issue will add real-time collaboration features (e.g., via WebSocket or Server-Sent Events).

---

### Audit & Compliance

**Limitation:** No audit trail or compliance logging.

- No history of who created, modified, or deleted notes and when.
- No ability to restore deleted notes or view note versions.
- No compliance with retention or data governance policies.

**Workaround for Development:** The `authorId` and timestamp fields (`createdAt`, `updatedAt`, `archivedAt`) can be used to track changes. For comprehensive auditing, a future issue will implement an audit log.

**Future Resolution:** A follow-up issue will add:

- Complete audit trail (create, update, delete, archive events with actor and timestamp)
- Version history (ability to view and restore previous note content)
- Compliance logging integration

---

### Validation & Error Handling

**Limitation:** Minimal validation — only empty/missing field checks.

- No length limits on content (e.g., max 5000 characters)
- No spam or security scanning
- No profanity filtering
- No detection of sensitive data (PII, credentials, etc.)

**Workaround:** Implement additional validation in UI layers or extend `validation.ts` with custom rules.

**Future Resolution:** A follow-up issue will add:

- Content length and format validation
- Sensitive data detection
- Rate limiting and spam prevention

---

### Performance & Scaling

**Limitation:** In-memory storage does not scale beyond browser/process memory.

- Performance degrades with large numbers of notes (100k+)
- No pagination or lazy-loading support in the service layer
- No indexing (queries iterate through all notes)
- No caching or memoization

**Workaround for Testing:** Tests use small, deterministic fixture sets (5 notes by default).

**Future Resolution:** A follow-up issue will add:

- Pagination support (`getByContact(contactId, limit, offset)`)
- Query optimization and indexing
- Backend persistence layer for scalability

---

### Accessibility Edge Cases

**Limitation:** Accessibility coverage is limited to core scenarios.

- No testing with real assistive technologies (screen readers, voice control)
- No ARIA live region updates for multi-step workflows
- No keyboard navigation for complex interactions (e.g., drag-to-reorder archived notes)

**Workaround:** Follow WCAG 2.1 AA guidelines in component implementation (see [ACCESSIBILITY.md](./ACCESSIBILITY.md)).

**Future Resolution:** A follow-up issue will include:

- Accessibility testing with real assistive technologies
- Enhanced keyboard navigation
- Compliance audit against WCAG 2.1 AAA

---

### Search & Filtering

**Limitation:** No search or filter capabilities.

- Cannot search notes by content
- Cannot filter notes by author, date, or tag
- Cannot sort notes (e.g., by creation date, most recently updated)

**Workaround:** UI layers can implement client-side filtering and sorting.

**Future Resolution:** A follow-up issue will add:

- Full-text search on note content
- Filter by author, date range, archive status
- Sort options (newest, oldest, recently updated)

---

### Relationships & References

**Limitation:** Notes are isolated — no relationships or references to other entities.

- Cannot link notes to tickets, projects, or tasks
- Cannot mention other users in notes (`@alice`, notifications)
- Cannot attach files or images
- Cannot reply to or comment on notes

**Workaround:** Use note content as a freeform text field (user can type `@alice` or ticket numbers manually).

**Future Resolution:** A follow-up issue will add:

- Mention/tag system with notifications
- File attachments
- Comment threads within notes
- Integration with related entities (tickets, projects)

---

### Test Coverage Limitations

**Limitation:** No end-to-end tests or integration tests.

- Component tests use mocked `NoteService` (not real persistence)
- No tests for real database queries or API endpoints
- No tests for concurrent multi-user scenarios
- No performance/load tests

**Workaround:** Manual testing and fixture-based unit tests provide adequate coverage for isolated development.

**Future Resolution:** A follow-up issue will add:

- E2E tests with real persistence layer
- Concurrent/multi-user scenarios
- Load and performance tests

---

## Integration Path

### Phase 1: Current (V2 Isolated Tool)

- ✓ Core service logic (CRUD, validation, errors)
- ✓ Contract layer (non-UI execution contract)
- ✓ React UI components
- ✓ Unit and component tests
- ✓ Documentation and fixtures

### Phase 2: Persistence Integration (Future Issue)

- Add localStorage / IndexedDB storage adapter
- Add backend API endpoints
- Migrate from in-memory to persistent storage
- Add migrations/schema versioning

### Phase 3: Main App Integration (Future Issue)

- Add routing and navigation
- Render in contact detail panel
- Connect to main app's authentication
- Integrate with main app's styling and design system

### Phase 4: Advanced Features (Future Issues)

- Real-time collaboration
- Audit trail and versioning
- Search and filtering
- Mentions and comments
- File attachments

---

## Dependency Strategy

The tool intentionally has **no external dependencies** beyond React and TypeScript:

- No ORM (uses in-memory Map)
- No API client (no API calls)
- No database driver (no persistence)
- No notification library (no real-time updates)
- No search engine (no full-text search)

This allows the tool to remain small, testable, and easy to understand.

When integrating with persistence/services in future issues, introduce dependencies at those points, not earlier.

---

## Workarounds & Recommendations

### For Development

- Use `seedNotes` fixture for consistent test data
- Set `delayMs` to simulate realistic async behavior
- Implement UI-level permission checks based on `authorId`
- Add local validation rules in UI components

### For Production (Post-Integration)

- Will require separate persistence issue (database, API)
- Will require separate authentication integration
- Will require separate real-time collaboration infrastructure
- Consider Feature Flags for gradual rollout

### For Contributors

- Do not attempt to add persistence, authentication, or real-time features in this issue
- Keep changes isolated to `tools/v2/team/shared-contact-notes/`
- Refer limitations to follow-up issues in documentation
- Use the limitations as motivation for the next phase of work

---

## FAQ

**Q: When will the tool be integrated with the main app?**

A: Integration is planned for a separate issue after this core implementation is merged. See [Follow-Up Implementation Shape](./review-notes.md#follow-up-implementation-shape).

**Q: Can I add authentication to this tool?**

A: Not in this issue. Keep the tool isolated. A follow-up issue will handle app-wide authentication integration.

**Q: Why is there no persistence layer?**

A: Persistence is intentionally deferred to keep this issue small and focused on core business logic. A follow-up persistence issue will add storage.

**Q: Can I add search?**

A: Not in this issue. Search is a follow-up feature. For now, UI layers can implement basic client-side filtering.

**Q: How do I handle concurrent edits?**

A: This tool does not support multi-user scenarios yet. For now, accept last-write-wins behavior. Real-time collaboration is a future issue.

---

## See Also

- [README.md](../README.md) — Tool overview
- [review-notes.md](./review-notes.md) — Reviewer checklist
- [SETUP.md](./SETUP.md) — Development setup

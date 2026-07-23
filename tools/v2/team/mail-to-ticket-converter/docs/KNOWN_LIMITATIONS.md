# Known Limitations — Mail-to-Ticket Converter

This document outlines the current limitations of the Mail-to-Ticket Converter tool. These are intentional constraints for the V2 isolated release or areas that require future integration work.

## Current Scope Limitations

### No Main App Integration

- The tool does not connect to the main mail application's inbox
- No routing or navigation integration with the main app
- No shared authentication or authorization context
- No access to the main application's database or state

### No Real Data Persistence

- All data is ephemeral (in-memory only)
- No database persistence for tickets or conversions
- Data is lost on page refresh or service restart
- No audit trail or history tracking

### No Live Email Processing

- No SMTP/IMAP integration for real email fetching
- No webhook support for incoming emails
- No email parsing beyond the provided fixtures
- No attachment content handling (only boolean flag)

### No External Ticket System Integration

- No direct integration with ticket providers (Jira, GitHub Issues, etc.)
- No API calls to create or update external tickets
- No synchronization with external ticket status
- No external project or team mapping

### No Authentication or Authorization

- No user authentication checks
- No role-based access control
- No permission validation for ticket operations
- No audit logging of who performed actions

### No Notification System

- No email notifications when tickets are assigned
- No in-app alerts for ticket status changes
- No mention or @-mention functionality
- No subscription or watch mechanisms

### No Search or Filter

- No search functionality across emails or tickets
- No filtering by status, priority, or assignee
- No sorting capabilities
- No advanced query support

### No Pagination

- No pagination for large email or ticket lists
- All data loads at once (not scalable for large datasets)
- No virtual scrolling for performance
- No lazy loading strategies

### No Undo Operations

- No undo for ticket creation
- No revert for status changes
- No delete or soft-delete functionality
- No operation history or rollback

### No Real-time Updates

- No WebSocket or SSE support
- No live updates when other users make changes
- No conflict resolution for concurrent edits
- No optimistic UI updates with rollback

### No Attachment Handling

- Attachments are only flagged as present/absent
- No attachment preview or download
- No attachment metadata extraction
- No attachment storage or management

### No Bulk Operations

- No batch ticket creation
- No bulk status updates
- No bulk assignment changes
- No export or import functionality

### No Advanced Ticket Features

- No ticket dependencies or relationships
- No subtasks or parent tickets
- No time tracking or estimation
- No custom fields or workflows
- No SLA (Service Level Agreement) tracking

### No Analytics or Reporting

- No trend analysis over time
- No performance metrics dashboards
- No team productivity reports
- No export of analytics data

### No Mobile Optimization

- Limited responsive design
- No native mobile app support
- No offline functionality
- No push notifications

## Technical Constraints

### Fixture-Based Data

- All test data is static JSON fixtures
- No dynamic or realistic test data generation
- Fixtures may not represent all edge cases
- No fixture management UI or tools

### Single-Threaded Processing

- No background job processing
- No queue system for heavy operations
- No parallel processing capabilities
- Synchronous-only operations

### No Error Recovery

- Limited error handling and recovery
- No retry mechanisms for failed operations
- No circuit breaker patterns
- No graceful degradation

### No Internationalization

- No i18n support for multiple languages
- No locale-specific date/time formatting
- No timezone handling
- English-only UI and messages

## Future Integration Requirements

To overcome these limitations, future integration issues would need to address:

1. **Data Layer**: Add database persistence and ORM integration
2. **Auth Layer**: Connect to main app authentication and authorization
3. **Email Layer**: Integrate with real email providers (IMAP/SMTP)
4. **Ticket Layer**: Add provider-specific adapters (Jira, GitHub, etc.)
5. **UI Layer**: Add routing, navigation, and main app shell integration
6. **Notification Layer**: Add email, in-app, and push notification systems
7. **Search Layer**: Add search indexing and query capabilities
8. **Real-time Layer**: Add WebSocket or SSE for live updates
9. **Analytics Layer**: Add metrics collection and reporting dashboards

Each of these requires a separate, approved integration issue before implementation.

# Demo Inbox Preview

## Overview

The Demo Inbox Preview provides a folder-local preview of the demo inbox dataset without wiring into live inbox systems. This feature allows maintainers to populate and manage demo UI data while keeping all demo-admin tooling isolated from production mail flows.

## Components

### DemoInboxPreview

The main component that orchestrates the inbox preview experience:

- **Purpose**: Complete inbox preview without live integration
- **Features**: List view, reader view, folder tabs (inbox, starred, archive, trash)
- **Data**: Uses deterministic demo data safe for public repository review
- **Isolation**: No connection to production mail systems

### DemoInboxList

Displays messages in a familiar email list format:

- **Layout**: Avatar, sender info, subject, snippet, metadata
- **Features**: Trust badges, proof status, attachment indicators
- **Styling**: Matches real inbox patterns with demo-specific styling
- **Interactions**: Click to select message for reader view

### DemoMailReader

Shows full message content with rich formatting:

- **Content**: HTML email body rendering, attachments, calendar events
- **Metadata**: Proof records, sender verification, timestamps
- **Actions**: Simulated reply/forward/archive buttons (demo only)
- **Navigation**: Back to list functionality

## Demo Data Structure

### Messages

- **Safe email addresses**: Only @example.com, @example.org, \*.stealth.demo
- **Rich content**: HTML bodies, attachments, calendar events
- **Metadata**: Labels, proof records, sender policies
- **Folders**: Inbox, starred, archive, trash distribution

### Senders

- **Verified personas**: Consistent names and trust levels
- **Relay nodes**: Demo relay infrastructure references
- **Trust indicators**: Trusted/untrusted classification for testing

### Attachments

- **File types**: PDF, DOCX, XLSX, PNG with realistic sizes
- **Demo URLs**: Safe placeholder paths for preview
- **Metadata**: Proper MIME types and file size formatting

### Calendar Events

- **Meeting details**: Safe locations and attendee lists
- **Time ranges**: Realistic scheduling with demo timestamps
- **Integration**: Embedded in messages with preview cards

## Usage

```typescript
import { DemoInboxPreview } from "@/features/demo-admin-dashboard";

function AdminDashboard() {
  return (
    <div>
      <h1>Demo Admin Dashboard</h1>
      <DemoInboxPreview className="mt-6" />
    </div>
  );
}
```

## Data Safety

All demo data follows these safety guidelines:

- **No real PII**: All names, addresses, content are fictional
- **Safe domains**: Only approved demo domains are used
- **Deterministic**: Same inputs always produce same outputs
- **Public safe**: All content suitable for public repository review
- **No secrets**: No real keys, tokens, or credentials

## Folder Structure

All implementation lives under `src/features/demo-admin-dashboard/`:

```
components/
├── DemoInboxPreview.tsx     # Main preview component
├── DemoInboxList.tsx        # Message list view
└── DemoMailReader.tsx       # Message reader view

fixtures/
└── demoInboxData.ts         # Demo data generation

docs/
└── demo-inbox-preview.md    # This documentation
```

## Future Enhancements

The current implementation provides a complete folder-local preview. Future iterations could add:

- Search and filtering within demo data
- Message composition simulation
- Advanced folder management
- Bulk operations preview
- Integration with other demo admin features

## Integration Notes

This feature is designed to be completely isolated from production systems:

- **No API calls**: All data is generated locally
- **No state persistence**: Demo state is ephemeral
- **No side effects**: No impact on real mail processing
- **Safe testing**: Maintainers can experiment without risk

The components mirror real inbox functionality to provide authentic preview experience while maintaining complete isolation from live systems.

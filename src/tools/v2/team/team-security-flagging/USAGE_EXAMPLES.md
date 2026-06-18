# Team Security Flagging Tool - Usage Examples

This guide demonstrates how to use the Team Security Flagging tool components in various scenarios.

## Basic Usage

### Full Tool Integration

```tsx
import { TeamSecurityFlagging } from '@/tools/v2/team/team-security-flagging';

export function SecurityPage() {
  return <TeamSecurityFlagging />;
}
```

## Component-Level Usage

### Using Individual Components

```tsx
import {
  FlagList,
  FlagDetail,
  FlagForm,
  FlagFilters,
  useFlagData,
} from '@/tools/v2/team/team-security-flagging';

export function CustomFlagView() {
  const { flags, selectedFlag, selectFlag, createFlag } = useFlagData();

  return (
    <div className="flex gap-4">
      <FlagList
        flags={flags}
        selectedId={selectedFlag?.id}
        onSelect={selectFlag}
      />
      {selectedFlag && (
        <FlagDetail flag={selectedFlag} />
      )}
    </div>
  );
}
```

### Compact Flag List for Sidebar

```tsx
import { CompactFlagList, useFlagData } from '@/tools/v2/team/team-security-flagging';

export function SecuritySidebar() {
  const { flags, selectFlag } = useFlagData({
    filters: { status: ['pending'] },
    pageSize: 10,
  });

  return (
    <aside className="w-64">
      <h3 className="font-semibold mb-3">Pending Flags</h3>
      <CompactFlagList
        flags={flags}
        onSelect={selectFlag}
      />
    </aside>
  );
}
```

## State Components

### Empty State

```tsx
import { EmptyState } from '@/tools/v2/team/team-security-flagging';

export function NoFlags() {
  return (
    <EmptyState
      variant="no-flags"
      onCreateFlag={() => console.log('Create clicked')}
    />
  );
}
```

### Loading State

```tsx
import { LoadingState, Spinner } from '@/tools/v2/team/team-security-flagging';

export function LoadingFlags() {
  return (
    <div>
      {/* Full list skeleton */}
      <LoadingState variant="list" count={5} />
      
      {/* Detail skeleton */}
      <LoadingState variant="detail" />
      
      {/* Minimal spinner */}
      <LoadingState variant="minimal" />
      
      {/* Standalone spinner */}
      <Spinner size="lg" />
    </div>
  );
}
```

### Error State

```tsx
import { ErrorState } from '@/tools/v2/team/team-security-flagging';

export function FlagError({ error }: { error: Error }) {
  const handleRetry = () => {
    // Retry logic
  };

  return (
    <ErrorState
      error={error}
      title="Failed to load flags"
      onRetry={handleRetry}
      variant="page"
    />
  );
}
```

### Success State

```tsx
import { SuccessState, SuccessBanner } from '@/tools/v2/team/team-security-flagging';

export function FlagSuccess() {
  return (
    <>
      {/* Full page success */}
      <SuccessState
        title="Flag Created"
        message="Your security flag has been submitted for review."
        action={{
          label: 'View Flag',
          onClick: () => console.log('View'),
        }}
      />
      
      {/* Banner notification */}
      <SuccessBanner
        message="Flag updated successfully"
        onClose={() => console.log('Close')}
      />
    </>
  );
}
```

## Custom Hooks

### useFlagData Hook

```tsx
import { useFlagData } from '@/tools/v2/team/team-security-flagging';
import type { FlagFilters } from '@/tools/v2/team/team-security-flagging';

export function CustomFlagManager() {
  const [filters, setFilters] = useState<FlagFilters>({
    severity: ['high', 'critical'],
    status: ['pending'],
  });

  const {
    flags,
    isLoading,
    error,
    createFlag,
    updateFlag,
    deleteFlag,
    refresh,
  } = useFlagData({
    filters,
    autoLoad: true,
  });

  const handleCreate = async () => {
    await createFlag({
      title: 'New Security Flag',
      description: 'Detailed description',
      category: 'phishing',
      severity: 'high',
    });
  };

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {flags.map(flag => (
        <div key={flag.id}>{flag.title}</div>
      ))}
      <button onClick={handleCreate}>Create Flag</button>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

### useKeyboard Hook

```tsx
import { useKeyboard } from '@/tools/v2/team/team-security-flagging';

export function KeyboardEnabledView() {
  const [showDialog, setShowDialog] = useState(false);

  useKeyboard({
    enabled: true,
    onNewFlag: () => setShowDialog(true),
    onRefresh: () => console.log('Refresh'),
    onCloseDialog: () => setShowDialog(false),
  });

  return (
    <div>
      <p>Press 'N' to create a new flag</p>
      <p>Press 'R' to refresh</p>
      <p>Press '/' to search</p>
    </div>
  );
}
```

## Advanced Usage

### Custom Filtering

```tsx
import { useState } from 'react';
import {
  FlagFilters,
  FilterBadge,
  useFlagData,
  type FlagFilters as FlagFiltersType,
} from '@/tools/v2/team/team-security-flagging';

export function AdvancedFiltering() {
  const [filters, setFilters] = useState<FlagFiltersType>({});
  const { flags } = useFlagData({ filters });

  const activeFilters = [
    ...(filters.severity || []).map(s => ({ type: 'severity', value: s })),
    ...(filters.status || []).map(s => ({ type: 'status', value: s })),
  ];

  const removeFilter = (type: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: (prev[type as keyof FlagFiltersType] as string[])?.filter(
        v => v !== value
      ),
    }));
  };

  return (
    <div>
      {/* Filter badges */}
      <div className="flex gap-2 mb-4">
        {activeFilters.map(filter => (
          <FilterBadge
            key={`${filter.type}-${filter.value}`}
            label={`${filter.type}: ${filter.value}`}
            onRemove={() => removeFilter(filter.type, filter.value)}
          />
        ))}
      </div>

      {/* Filter panel */}
      <FlagFilters
        filters={filters}
        onFiltersChange={setFilters}
        resultCount={flags.length}
      />
    </div>
  );
}
```

### Dialog Integration

```tsx
import { useState } from 'react';
import {
  FlagForm,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/tools/v2/team/team-security-flagging';

export function CreateFlagDialog() {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (data: any) => {
    // Submit logic
    console.log('Creating flag:', data);
    setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)}>
        Create Flag
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Security Flag</DialogTitle>
          </DialogHeader>
          <FlagForm
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### Accessibility Utilities

```tsx
import {
  announce,
  trapFocus,
  createFocusManager,
  formatDateForSR,
} from '@/tools/v2/team/team-security-flagging/utils/accessibility';

export function AccessibleComponent() {
  const handleAction = () => {
    // Announce to screen readers
    announce('Action completed successfully');
  };

  const handleDelete = () => {
    // Assertive announcement for important actions
    announce('Flag has been deleted', 'assertive');
  };

  // Focus management
  const focusManager = createFocusManager();
  
  const openModal = () => {
    focusManager.capture();
    // Open modal logic
  };

  const closeModal = () => {
    // Close modal logic
    focusManager.restore();
  };

  // Format dates for screen readers
  const date = new Date();
  const srText = formatDateForSR(date); // "2 days ago"

  return (
    <div>
      <button onClick={handleAction}>Complete Action</button>
      <button onClick={handleDelete}>Delete Flag</button>
      <p>
        <span aria-label={srText}>
          {date.toLocaleDateString()}
        </span>
      </p>
    </div>
  );
}
```

## Type Usage

### Working with Types

```tsx
import type {
  SecurityFlag,
  FlagSeverity,
  FlagStatus,
  FlagCategory,
  CreateFlagFormData,
  UpdateFlagFormData,
} from '@/tools/v2/team/team-security-flagging';

// Type-safe flag creation
const newFlag: CreateFlagFormData = {
  title: 'Security Concern',
  description: 'Detailed description',
  category: 'phishing' as FlagCategory,
  severity: 'high' as FlagSeverity,
  tags: ['urgent', 'email'],
};

// Type-safe flag update
const updateData: UpdateFlagFormData = {
  status: 'resolved' as FlagStatus,
  assignedTo: 'user-123',
};

// Type guard example
function isCritical(flag: SecurityFlag): boolean {
  return flag.severity === 'critical';
}
```

## Constants Usage

```tsx
import {
  SEVERITY_META,
  STATUS_META,
  CATEGORY_META,
  KEYBOARD_SHORTCUTS,
  ARIA_LABELS,
  SR_ANNOUNCEMENTS,
} from '@/tools/v2/team/team-security-flagging';

export function FlagMetadata({ flag }: { flag: SecurityFlag }) {
  const severityInfo = SEVERITY_META[flag.severity];
  const statusInfo = STATUS_META[flag.status];
  const categoryInfo = CATEGORY_META[flag.category];

  return (
    <div>
      <span className={severityInfo.color}>
        {severityInfo.label}
      </span>
      <p>{severityInfo.description}</p>
      
      {/* ARIA labels */}
      <button aria-label={ARIA_LABELS.createButton}>
        Create
      </button>
      
      {/* Screen reader announcement */}
      <div role="status">
        {SR_ANNOUNCEMENTS.flagCreated(flag.title)}
      </div>
    </div>
  );
}
```

## Integration Examples

### With React Query

```tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { FlagList, FlagDetail } from '@/tools/v2/team/team-security-flagging';
import type { SecurityFlag } from '@/tools/v2/team/team-security-flagging';

export function QueryIntegration() {
  const { data: flags, isLoading } = useQuery({
    queryKey: ['security-flags'],
    queryFn: fetchFlags,
  });

  const createMutation = useMutation({
    mutationFn: createFlagAPI,
    onSuccess: () => {
      // Invalidate and refetch
    },
  });

  return (
    <div>
      {isLoading ? (
        <LoadingState variant="list" />
      ) : (
        <FlagList
          flags={flags || []}
          onSelect={(flag) => console.log(flag)}
        />
      )}
    </div>
  );
}
```

### With State Management (Zustand)

```tsx
import { create } from 'zustand';
import type { SecurityFlag, FlagFilters } from '@/tools/v2/team/team-security-flagging';

interface FlagStore {
  flags: SecurityFlag[];
  filters: FlagFilters;
  selectedFlag: SecurityFlag | null;
  setFlags: (flags: SecurityFlag[]) => void;
  setFilters: (filters: FlagFilters) => void;
  selectFlag: (flag: SecurityFlag | null) => void;
}

const useFlagStore = create<FlagStore>((set) => ({
  flags: [],
  filters: {},
  selectedFlag: null,
  setFlags: (flags) => set({ flags }),
  setFilters: (filters) => set({ filters }),
  selectFlag: (selectedFlag) => set({ selectedFlag }),
}));

export function StoreIntegration() {
  const { flags, selectedFlag, selectFlag } = useFlagStore();

  return (
    <FlagList
      flags={flags}
      selectedId={selectedFlag?.id}
      onSelect={selectFlag}
    />
  );
}
```

## Testing Examples

### Unit Testing

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlagList } from '@/tools/v2/team/team-security-flagging';

describe('FlagList', () => {
  it('renders flags correctly', () => {
    const flags = [
      {
        id: '1',
        title: 'Test Flag',
        // ... other properties
      },
    ];

    render(
      <FlagList
        flags={flags}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Test Flag')).toBeInTheDocument();
  });

  it('calls onSelect when flag is clicked', async () => {
    const onSelect = jest.fn();
    const flags = [/* ... */];

    render(
      <FlagList
        flags={flags}
        onSelect={onSelect}
      />
    );

    await userEvent.click(screen.getByText('Test Flag'));
    expect(onSelect).toHaveBeenCalledWith(flags[0]);
  });
});
```

## Best Practices

1. **Always provide labels**: Use `aria-label` or associated `Label` components
2. **Handle loading states**: Show `LoadingState` while data is fetching
3. **Handle errors gracefully**: Use `ErrorState` with retry functionality
4. **Announce dynamic updates**: Use the `announce()` utility
5. **Respect keyboard navigation**: Enable keyboard shortcuts where appropriate
6. **Test with assistive technology**: Verify screen reader compatibility
7. **Use TypeScript**: Leverage the type system for safety
8. **Follow the accessibility guide**: Reference ACCESSIBILITY.md

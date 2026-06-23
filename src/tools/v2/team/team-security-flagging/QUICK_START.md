# Team Security Flagging Tool - Quick Start Guide

## 🚀 Getting Started

### Import the Tool

```tsx
import { TeamSecurityFlagging } from "@/tools/v2/team/team-security-flagging";

function App() {
  return <TeamSecurityFlagging />;
}
```

That's it! The tool is fully self-contained and ready to use.

## 📦 What's Included

### Main Component

```tsx
<TeamSecurityFlagging />
```

The complete tool with:

- Flag list view
- Detail panel
- Create/edit forms
- Filtering system
- Keyboard shortcuts
- Full accessibility

### Individual Components

```tsx
import {
  FlagList,
  FlagDetail,
  FlagForm,
  FlagFilters,
} from "@/tools/v2/team/team-security-flagging";
```

### Custom Hooks

```tsx
import { useFlagData, useKeyboard } from "@/tools/v2/team/team-security-flagging";
```

### Types

```tsx
import type {
  SecurityFlag,
  FlagSeverity,
  FlagStatus,
  FlagCategory,
} from "@/tools/v2/team/team-security-flagging";
```

## ⌨️ Keyboard Shortcuts

| Key        | Action          |
| ---------- | --------------- |
| `/`        | Focus search    |
| `n`        | Create new flag |
| `r`        | Refresh list    |
| `f`        | Toggle filters  |
| `j` or `↓` | Next item       |
| `k` or `↑` | Previous item   |
| `Enter`    | Open selected   |
| `Esc`      | Close dialog    |
| `?`        | Show shortcuts  |

## 🎨 Key Features

### Filtering

- Search by keyword
- Filter by severity (low, medium, high, critical)
- Filter by status (pending, reviewing, resolved, dismissed)
- Filter by category (phishing, malware, spam, etc.)

### Operations

- Create security flags
- Edit existing flags
- Delete flags
- Resolve flags
- Dismiss flags

### States

- Empty states (no flags, no results)
- Loading states (skeleton loaders)
- Error states (with retry)
- Success feedback

## 📚 Documentation

- **[README.md](./README.md)** - Full documentation
- **[ACCESSIBILITY.md](./ACCESSIBILITY.md)** - Accessibility guide
- **[USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)** - Code examples
- **[styles/README.md](./styles/README.md)** - Visual style guide

## 🔧 Customization

### Using Individual Components

```tsx
import { FlagList, useFlagData } from "@/tools/v2/team/team-security-flagging";

function MyCustomView() {
  const { flags, selectFlag } = useFlagData();

  return <FlagList flags={flags} onSelect={selectFlag} />;
}
```

### Custom Filtering

```tsx
import { useFlagData } from "@/tools/v2/team/team-security-flagging";

function CriticalFlags() {
  const { flags } = useFlagData({
    filters: {
      severity: ["critical"],
      status: ["pending"],
    },
  });

  return <FlagList flags={flags} />;
}
```

## ♿ Accessibility

This tool is fully accessible:

- ✅ WCAG 2.1 AA compliant
- ✅ Full keyboard navigation
- ✅ Screen reader support
- ✅ High contrast mode
- ✅ Focus management
- ✅ ARIA labels throughout

Test with:

- Keyboard only (no mouse)
- Screen reader (NVDA, JAWS, VoiceOver)
- High contrast mode
- 200% zoom

## 🐛 Common Issues

### TypeScript Errors

**Issue**: Import errors

```
Cannot find module '@/tools/v2/team/team-security-flagging'
```

**Solution**: Ensure the path alias `@` is configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Styling Issues

**Issue**: Components look unstyled

**Solution**: Ensure Tailwind CSS is properly configured and the design system is loaded.

### Accessibility Issues

**Issue**: Screen reader not announcing updates

**Solution**: Check that the live region utility is initialized. The tool handles this automatically.

## 📊 Mock Data

The tool includes mock data generation for development:

```tsx
const { flags } = useFlagData({
  autoLoad: true, // Automatically loads mock data
});
```

Mock data includes:

- 10-20 sample flags
- Various severities and statuses
- Realistic metadata
- Comments and tags

## 🎯 Next Steps

1. **Try It Out**

   ```tsx
   import { TeamSecurityFlagging } from "@/tools/v2/team/team-security-flagging";

   function TestPage() {
     return <TeamSecurityFlagging />;
   }
   ```

2. **Read the Docs**
   - Start with [README.md](./README.md)
   - Check [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for patterns

3. **Test Accessibility**
   - Use keyboard only
   - Try with a screen reader
   - Check contrast in dark mode

4. **Integrate**
   - Add to your routing
   - Connect to real API (future)
   - Customize as needed

## 💡 Tips

- **Keyboard shortcuts** work globally when the tool is mounted
- **Mock data** regenerates on each load for testing
- **Types** are fully exported for type-safe usage
- **Components** are composable - mix and match
- **Accessibility** is built-in, not bolted on
- **Documentation** is comprehensive - check it out!

## 🆘 Need Help?

1. Check [README.md](./README.md) for architecture details
2. See [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for patterns
3. Review [ACCESSIBILITY.md](./ACCESSIBILITY.md) for a11y info
4. Check [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) for completion status

## ⚡ Performance

- **Bundle size**: Minimal (tree-shakeable)
- **Rendering**: Optimized with React best practices
- **CSS**: Tailwind utilities (no custom CSS)
- **Images**: SVG icons only (lucide-react)

## 🎉 You're Ready!

The tool is production-ready for UI/UX testing. Backend integration and routing are for future PRs.

```tsx
// That's all you need!
import { TeamSecurityFlagging } from "@/tools/v2/team/team-security-flagging";

<TeamSecurityFlagging />;
```

Happy coding! 🚀

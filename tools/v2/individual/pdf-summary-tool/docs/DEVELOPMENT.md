# PDF Summary Tool - Development Guide

Getting started with local development on the PDF Summary Tool.

## Prerequisites

- Node.js 18+ installed
- Git installed
- VS Code or your preferred editor

## Initial Setup

### 1. Clone and Navigate

```bash
# If you haven't cloned yet
git clone <repo-url>
cd stealth

# Or if already cloned
cd c:\Users\delig\stealth
```

### 2. Install Dependencies

```bash
# Install all dependencies (including PDF.js and testing libraries)
npm install
```

### 3. Verify Setup

```bash
# Check Node version
node --version  # Should be 18+

# Check npm version
npm --version   # Should be 9+

# Run tests to verify setup
npm test tests/unit
```

## Project Structure

```
tools/v2/individual/pdf-summary-tool/
├── components/          # React components
├── services/            # Business logic
├── hooks/              # React hooks
├── types/              # TypeScript definitions
├── utils/              # Pure utility functions
├── tests/              # Test suite
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── fixtures/           # Test data
├── config/             # Tool configuration
├── docs/               # Documentation (this folder)
└── ARCHITECTURE.md     # Architecture specification
```

## Development Workflow

### Starting Development

```bash
# 1. Create a feature branch
git checkout -b feature/pdf-summary-tool/your-feature-name

# 2. Start dev server (optional, for UI testing)
npm run dev

# 3. Open another terminal for testing
npm test:watch tests/unit
```

### Making Changes

All changes should be in `tools/v2/individual/pdf-summary-tool/`

Example workflow:

1. Create utility function in `utils/`
2. Create service in `services/`
3. Create hook in `hooks/`
4. Create component in `components/`
5. Write tests for each
6. Update types in `types/`
7. Update documentation

### Testing Your Changes

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/unit/utils/myUtil.spec.ts

# Run with grep filter
npm test -- --grep "keyword extraction"

# Watch mode (reruns on file changes)
npm test:watch tests/unit

# Check coverage
npm test -- --coverage
```

### Code Quality

```bash
# Check linting
npm run lint

# Format code
npm run format

# Check TypeScript
npx tsc --noEmit
```

## Debugging

### Browser DevTools

```bash
# 1. Start dev server
npm run dev

# 2. Open http://localhost:5173 in browser

# 3. Open DevTools (F12)

# 4. Set breakpoints and debug components
```

### localStorage Inspection

```typescript
// In browser console
localStorage.getItem("pdf-summary-tool:summaries");
localStorage.getItem("pdf-summary-tool:settings");
localStorage.clear(); // Clear all
```

### Node Debugger

```bash
# Add debugger; statement to code
debugger;

# Run with node debugger
node --inspect-brk ./node_modules/.bin/vitest run tests/unit/myTest.spec.ts

# Open chrome://inspect in Chrome
```

## Common Tasks

### Add a New Component

1. Create file: `components/MyComponent.tsx`
2. Create test: `tests/unit/components/MyComponent.spec.tsx`
3. Add types to `types/index.ts`
4. Document in `components/README.md`

### Add a New Service

1. Create file: `services/myService.ts`
2. Create test: `tests/unit/services/myService.spec.ts`
3. Add types to `types/index.ts`
4. Document in `docs/API.md`

### Add a New Hook

1. Create file: `hooks/useMyHook.ts`
2. Create test: `tests/unit/hooks/useMyHook.spec.ts`
3. Add types to `types/index.ts`

### Add a New Utility

1. Create file: `utils/myUtil.ts`
2. Create test: `tests/unit/utils/myUtil.spec.ts`
3. Document in `utils/README.md`

## Environment Variables

This tool doesn't need environment variables for local development. All configuration is in `config/defaults.ts`.

If you need tool-specific env vars in the future, document them here and add to `.env.example`.

## Building

```bash
# Build main app (includes all tools)
npm run build

# Build for development
npm run build:dev

# Preview build
npm run preview
```

## Troubleshooting

### Tests Failing

```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules
npm install

# Run tests again
npm test
```

### Module Not Found Errors

```bash
# Check imports use correct relative paths
# ❌ import from '../../../src/...'  (wrong)
# ✅ import from '../services/...'  (correct)

# Verify file exists and is exported
ls -la tools/v2/individual/pdf-summary-tool/utils/
```

### localStorage Issues

```bash
# Clear localStorage in browser
localStorage.clear()

# Or in tests, use mock:
const mockLocalStorage = { ... }
```

### TypeScript Errors

```bash
# Check types compile
npx tsc --noEmit

# Update types in types/index.ts if needed
```

## Performance Tips

### Development

- Use `npm run dev` for hot reload
- Use `npm test:watch` for watch mode
- Keep files focused and small
- Use React DevTools to profile components

### Production Build

- Use lazy loading for large modules
- Memoize expensive computations
- Use code splitting if needed
- Monitor bundle size

## Next Steps

1. **Read ARCHITECTURE.md** - Understand the architecture
2. **Read CONTRIBUTOR_GUIDE.md** - Learn contribution patterns
3. **Check existing code** - See examples of each module type
4. **Start implementing** - Begin with a small feature

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev)
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)

## Questions?

1. Check the [ARCHITECTURE.md](../ARCHITECTURE.md)
2. Review [CONTRIBUTOR_GUIDE.md](../CONTRIBUTOR_GUIDE.md)
3. Ask in PR comments
4. Check existing module examples

Good luck! 🚀

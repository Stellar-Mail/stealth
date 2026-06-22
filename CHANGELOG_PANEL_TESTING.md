# Changelog Panel - Testing & Validation Guide

## Pre-flight Checklist

- [ ] Dependencies installed successfully
- [ ] No TypeScript errors: `npm run lint`
- [ ] Component renders without console errors
- [ ] Existing tests pass

---

## 1. Visual Regression Testing

### Setup

1. Take screenshots of both versions side-by-side
2. Use browser DevTools zoom at 100%
3. Test at 1440px, 1024px, and 768px widths

### Test Cases

#### 1.1 Default State

**Expected:**

- Release notes header visible
- Entries displayed with distinct borders
- Category badges properly styled
- Version and date information clear
- "All read" badge visible (if hasUnread prop true)

**Steps:**

```bash
1. Navigate to Settings → Changelog tab
2. Verify header text displays correctly
3. Verify at least one entry is visible
4. Check badge colors match design system
```

#### 1.2 Hover States

**Expected:**

- Entry background brightens slightly on hover
- Border color changes on hover
- Subtle shadow appears on hover
- Link color changes on hover

**Steps:**

```bash
1. Hover over an entry card
2. Observe background transition
3. Observe border brightness change
4. Hover over external link
5. Observe text color change
```

**Screenshots:**

- Before hover
- During hover
- After hover (return to normal)

#### 1.3 Focus States (Keyboard Navigation)

**Expected:**

- Clear focus ring around entry cards
- Clear focus ring around links
- Focus order follows document order
- Focus ring color matches design system

**Steps:**

```bash
1. Press Tab key repeatedly
2. Each interactive element gets focus ring
3. Focus ring is clearly visible
4. Press Enter on links to navigate
```

#### 1.4 Empty State

**Expected:**

- If no entries exist, show empty state message
- Message is centered and readable
- Background styling consistent

**Steps:**

```bash
1. Mock entries = [] in data.ts
2. Reload component
3. Verify empty state displays
4. Check message text is clear
```

#### 1.5 Read vs. Unread States

**Expected:**

- Unread entries have brighter background
- Unread entries have brighter border
- Unread entries have green dot indicator
- Read entries have dimmer styling

**Steps:**

```bash
1. Check if entry is marked as unread
2. Compare styling to read entry
3. Verify green dot is visible
4. Check contrast ratio meets WCAG AA
```

---

## 2. Interaction Testing

### 2.1 External Links

**Test:** Links navigate correctly

```bash
1. Locate entry with link (e.g., "View audit log")
2. Click link
3. Verify new page/tab opens
4. Verify rel="noopener noreferrer" is set (DevTools → Network)
```

**Test:** Link button states

```bash
1. Hover over link
2. Observe color change (sky-400 → sky-300)
3. Click link
4. Press Tab to reach link
5. Verify focus ring appears
```

### 2.2 Category Badge Interactions

**Test:** Badge hover effects

```bash
1. Hover over each category badge (UI, API, Protocol, Security)
2. Verify background color brightens
3. Verify border opacity changes
4. Check transition is smooth (200ms)
```

**Test:** Category colors
| Category | Bg Color | Text Color | Border | Hover |
|----------|----------|-----------|--------|-------|
| UI | sky-400 | sky-300 | sky-400/20 | bg-sky-400/20 |
| API | violet-400 | violet-300 | violet-400/20 | bg-violet-400/20 |
| Protocol | amber-400 | amber-300 | amber-400/20 | bg-amber-400/20 |
| Security | rose-400 | rose-300 | rose-400/20 | bg-rose-400/20 |

### 2.3 Scroll and Layout

**Test:** Scrolling behavior

```bash
1. Add many changelog entries (simulate)
2. Scroll through the list
3. Verify entries remain interactive
4. Verify no scroll jank
5. Check sticky header doesn't stick (none expected)
```

**Test:** Responsive layout

```bash
Viewport: 1440px
- All elements visible
- No horizontal scroll
- Proper spacing maintained

Viewport: 1024px
- Entries still readable
- No text truncation
- Links still clickable

Viewport: 768px
- Mobile-friendly layout
- Touch targets sufficient (44px minimum)
- Text readable without zoom
```

---

## 3. Accessibility Testing

### 3.1 Keyboard Navigation

**Test:** Tab order

```bash
1. Load Changelog Panel
2. Press Tab repeatedly from top
3. Expected order:
   - External links in order
   - Focus ring visible on each
   - No keyboard traps
   - Can reach all interactive elements
4. Shift+Tab reverses order
```

**Test:** Enter/Space on links

```bash
1. Tab to external link
2. Press Enter
3. New tab/window opens
4. Verify target URL is correct
```

### 3.2 Screen Reader Testing

#### Using NVDA (Windows) or JAWS

```bash
1. Enable screen reader
2. Navigate to Changelog Panel
3. Verify announcements:
   - "Release notes, heading level 3"
   - "v0.4.0, heading level 4"
   - "article" (for each entry)
   - "New changes available" (for unread dot)
   - "External link" (for links)
```

#### Using VoiceOver (Mac/iOS)

```bash
1. Enable VoiceOver (Cmd+F5)
2. Navigate with VO+arrow keys
3. Verify semantic announcements
4. Check heading levels
5. Verify alt text equivalents
```

### 3.3 Color Contrast

**Test:** WCAG AA compliance (4.5:1)

```bash
Using axe DevTools or similar:
1. Check text contrast ratios
2. Check link contrast ratios
3. All should meet WCAG AA minimum (4.5:1)
4. AAA compliance check (7:1) - stretch goal
```

**Elements to check:**

- Header text (h3)
- Entry titles (h5)
- Entry descriptions
- Category badge text
- Link text
- Muted foreground text (may be lower)

### 3.4 Heading Structure

**Test:** Outline validation

```bash
Using browser extension "Headings" or similar:
1. h3: "Release notes" (main)
2. h4: "v0.4.0" (version headers)
3. h5: Entry titles (within articles)
4. No skipped levels
5. Proper nesting maintained
```

### 3.5 ARIA Attributes

**Test:** ARIA labels and descriptions

```bash
1. Unread dot: aria-label="New changes available"
2. Time element: dateTime attribute set
3. Links: rel="noopener noreferrer"
4. Links: target="_blank" only where appropriate
```

---

## 4. State Transitions

### 4.1 Read/Unread Transitions

**Test:** Marking as read

```bash
1. Load component with unread entries
2. Observe green dot on unread entries
3. Component calls markAllSeen() on mount
4. In dev tools, check localStorage "stealth:changelog:seen-version"
5. Verify entries are no longer highlighted as unread
```

**Test:** Version comparison

```bash
1. isEntryUnread() should compare semantic versions
2. Entry with version "0.4.0" > "0.3.0" should be unread
3. Entry with version "0.3.0" < "0.4.0" should be read
```

### 4.2 Grouped View Updates

**Test:** Dynamic grouping

```bash
1. Add new entry to data.ts
2. Reload component
3. New entry appears under correct version
4. Entries within version maintain order
5. Versions appear in correct order (newest first)
```

---

## 5. Performance Testing

### 5.1 Render Performance

**Test:** useMemo optimization

```bash
1. Open DevTools → Performance tab
2. Record interaction in Changelog Panel
3. Check that grouping recalculation doesn't happen on every render
4. Verify only recalculates when entries change
5. Check Main thread time is minimal
```

**Expected:**

- Initial render < 100ms
- Interaction response < 16ms (60fps)
- No layout thrashing

### 5.2 Memory Usage

**Test:** Component cleanup

```bash
1. Open DevTools → Memory tab
2. Take heap snapshot
3. Navigate to Changelog Panel
4. Take another snapshot
5. Navigate away
6. Take third snapshot
7. Verify memory is freed on unmount
```

### 5.3 Bundle Size Impact

**Test:** Component size

```bash
Expected additions:
- CategoryBadge: ~2KB
- ReleaseHeader: ~1.5KB
- ChangelogEntry: ~2KB
- CSS classes: no additional CSS
- Icons: existing icons reused
```

---

## 6. Browser & Device Testing

### Desktop Browsers

- [ ] Chrome/Chromium (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest version)
- [ ] Edge (latest version)

### Mobile Browsers

- [ ] iOS Safari (latest version)
- [ ] Android Chrome (latest version)
- [ ] Android Firefox

### Test Viewport Sizes

- [ ] 1920px (desktop)
- [ ] 1440px (common desktop)
- [ ] 1024px (tablet landscape)
- [ ] 768px (tablet portrait)
- [ ] 480px (mobile portrait)
- [ ] 375px (small mobile)

---

## 7. Content Testing

### 7.1 Text Rendering

**Test:** Typography

```bash
1. Verify all font sizes render correctly:
   - h3: "text-sm font-semibold"
   - h4: "text-xs font-semibold"
   - h5: "text-xs font-medium"
   - Links: "text-[11px]"
   - Descriptions: "text-[11px]"

2. Verify line heights:
   - Descriptions: "leading-relaxed"
   - Titles: "leading-tight"
```

**Test:** Content overflow

```bash
1. Use long entry titles (100+ characters)
2. Use long descriptions (500+ characters)
3. Verify text wraps correctly
4. Verify no text is cut off
5. Verify layout remains stable
```

### 7.2 Link Text & Descriptions

**Test:** Link text clarity

```bash
1. All links have descriptive text (not just "link")
2. "View audit log" clearly indicates action
3. "Protocol spec" clearly indicates content
4. "SEP-0010 spec" clearly indicates external resource
```

---

## 8. Data Validation

### 8.1 Type Safety

**Test:** TypeScript compilation

```bash
1. Run: npm run lint
2. Verify no TypeScript errors
3. Check: ChangelogEntry type matches data
4. Check: Category type matches constants
```

### 8.2 Data Structure

**Test:** Entry structure

```
Each entry should have:
- id: string (unique)
- version: string (semantic)
- date: string (ISO 8601)
- category: string (ui, api, protocol, security)
- title: string (non-empty)
- description: string (non-empty)
- link?: { label: string, href: string }
```

**Test:** Version ordering

```bash
1. Entries grouped by version
2. Versions appear in descending order (newest first)
3. Entries within version maintain insertion order
4. Version format: major.minor.patch
```

---

## 9. Error Scenarios

### 9.1 Missing Data

**Test:** Null/undefined handling

```bash
1. Missing link: displays entry without link button
2. Invalid category: displays with fallback badge
3. Empty description: displays empty paragraph
4. Malformed date: verify locale date parsing doesn't crash
```

### 9.2 Edge Cases

**Test:** Large datasets

```bash
1. 100 entries
2. 10 versions
3. Multiple entries per category
4. All entries unread
5. All entries read
```

**Test:** Special characters

```bash
1. Accented characters in titles
2. Emoji in descriptions (if applicable)
3. Unicode characters
4. HTML special characters (< > & ")
```

---

## 10. Regression Testing

### Critical Paths to Verify

**Path 1: View changelog entries**

```bash
1. Settings tab exists
2. Changelog tab is visible
3. Clicking tab shows ChangelogPanel
4. Entries display correctly
5. Can scroll through list
```

**Path 2: Mark entries as read**

```bash
1. Component mounts
2. markAllSeen() is called
3. localStorage is updated
4. Visual unread indicator disappears
```

**Path 3: Visit external links**

```bash
1. Link button visible for entries with links
2. Clicking opens new tab
3. URL is correct
4. rel="noopener noreferrer" is set
```

---

## Test Report Template

```markdown
# Changelog Panel - Test Report

Date: [YYYY-MM-DD]
Tested By: [Name]
Browser: [Name + Version]
OS: [Windows/Mac/Linux]
Viewport: [pixels]

## Results Summary

- Visual Tests: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
- Interaction Tests: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
- Accessibility Tests: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
- Performance Tests: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL

## Issues Found

1. [Issue description]
   - Severity: High/Medium/Low
   - Steps to reproduce: [steps]
   - Expected: [expected result]
   - Actual: [actual result]

## Screenshots

- [Before state]
- [After state]
- [Error state if applicable]

## Sign-off

- [ ] All acceptance criteria met
- [ ] No regressions found
- [ ] Performance acceptable
- [ ] Accessibility compliant
- [ ] Ready for merge
```

---

## Automated Testing (Optional)

### Unit Tests to Consider

```typescript
// Example test structure
describe("ChangelogPanel", () => {
  it("renders release notes header", () => {
    // Test header text and description
  });

  it("groups entries by version", () => {
    // Test grouping logic
  });

  it("displays empty state when no entries", () => {
    // Test empty state
  });

  it("marks entries as read on mount", () => {
    // Test markAllSeen() effect
  });

  it("correctly determines unread entries", () => {
    // Test isEntryUnread() logic
  });
});

describe("CategoryBadge", () => {
  it("renders correct color for category", () => {
    // Test category colors
  });

  it("renders fallback badge for unknown category", () => {
    // Test fallback
  });
});

describe("ReleaseHeader", () => {
  it("displays version and date", () => {
    // Test header content
  });

  it("shows unread indicator", () => {
    // Test unread dot
  });
});

describe("ChangelogEntry", () => {
  it("renders entry content", () => {
    // Test entry display
  });

  it("renders link when present", () => {
    // Test conditional link
  });

  it("applies read/unread styling", () => {
    // Test conditional classes
  });
});
```

### E2E Tests to Consider

```typescript
// Example E2E test
test("User can view and interact with changelog", async ({ page }) => {
  await page.goto("/settings");
  await page.click('[data-tab="changelog"]');

  // Verify entries display
  const entry = page.locator("article").first();
  await expect(entry).toBeVisible();

  // Test hover
  await entry.hover();

  // Test keyboard navigation
  await page.keyboard.press("Tab");
});
```

---

## Sign-Off Checklist

Before merging, verify:

- [ ] All visual tests pass
- [ ] All interaction tests pass
- [ ] All accessibility tests pass
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Performance acceptable
- [ ] Browser compatibility confirmed
- [ ] Mobile responsive tested
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Existing behavior preserved
- [ ] Code reviewed
- [ ] PR description complete
- [ ] Screenshots included
- [ ] Documentation updated

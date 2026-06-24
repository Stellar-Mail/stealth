# Role-Based Mail Access

A self-contained V2 team tool that enforces which team members can read, write, assign, delete, or manage mail threads based on a declared role. This contribution adds the safety and performance guard layer, dynamic policy configuring tables, verification controls form, boundaries limit checks, and real-time audit logs.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/role-based-mail-access/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

---

## Workspace Structure

- **[types/index.ts](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/types/index.ts)**: Domain TypeScript definitions.
- **[fixtures/sample-access-requests.json](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/fixtures/sample-access-requests.json)**: JSON datasets holding valid clearance templates and 19 hostile threat injection vectors.
- **[guards/access-guards.mjs](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/guards/access-guards.mjs)**: Schema validators, sanitizers, and size limit checks.
- **[services/access.service.ts](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/services/access.service.ts)**: Core state manager handling policy configurations and limit verifiers.
- **[hooks/use-role-based-access.ts](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/hooks/use-role-based-access.ts)**: Custom React state synchronization hook.
- **[components/](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/components/)**: Dynamic matrix grids, verifier form cards, and logs.
- **[demo.tsx](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/demo.tsx)**: Preview development wrapper.

---

## Detailed Documentation

- **[Visual Style and States Guide](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/docs/README.md)**: Details empty, loading, granted, denied, and error warning states.
- **[Technical Architecture Spec](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/docs/ARCHITECTURE.md)**: Domain schema definitions and threat scan loop.
- **[Accessibility (a11y) Guide](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/docs/ACCESSIBILITY.md)**: Aria tags, focus ring controls, and screen-readers checklist.
- **[OSS Reviewer Validation Guide](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/docs/review-notes.md)**: Step-by-step verification guide.

---

## Running the Tests

### Running UI Service Tests (Vitest)

```bash
npx vitest -c tools/v2/team/role-based-mail-access/vitest.config.ts run
```

### Running Native Guard Tests (Node.js)

```bash
node --test tools/v2/team/role-based-mail-access/tests/access-guards.test.mjs
```

# Important Email Pinning Integration Constraints

This V1 individual tool is intentionally isolated. It is launch-ready as a mini-product contract, but it is not integrated with the main application until a future issue explicitly authorizes that work.

## Current Non-Integration Rule

Work for this issue must stay inside:

```text
tools/v1/individual/important-email-pinning/
```

Do not modify the main application shell, dashboard layout, navigation, routing, authentication, wallet core, Stellar integration core, database schema, inbox architecture, mail rendering engine, or existing design system.

## Allowed Dependencies

Folder-local code may depend on:

- TypeScript or test utilities already permitted for isolated tools;
- local fixtures under this folder;
- local pure services;
- local hooks and components;
- local documentation.

Dependencies should be replaceable by future adapter inputs and should not require a production runtime.

## Disallowed Dependencies

This tool must not directly depend on:

- main app router modules;
- dashboard shell modules;
- inbox store internals;
- mail provider SDK clients;
- authentication session internals;
- wallet or Stellar clients;
- production database clients;
- shared design-system source changes;
- production analytics or telemetry clients.

## Future Adapter Contract

A future integration issue may provide an adapter that passes normalized inputs into this folder. That adapter should provide:

- a list of message summaries;
- any existing pin records authorized for the current user;
- explicit user actions from host UI events;
- a persistence callback, if persistence is approved;
- a mailbox mutation callback only if explicitly approved and user initiated.

The adapter must keep the host application responsible for authentication, authorization, mailbox API access, routing, persistence, and error reporting outside this mini-product.

## Contributor Rules

Future contributors may:

- add folder-local components, services, hooks, fixtures, tests, and docs;
- refine the local pin record shape while preserving explicit user action;
- add deterministic sorting and filtering behavior;
- document new edge cases and review fixtures.

Future contributors may not:

- change app-level routes or navigation to expose this tool;
- alter inbox storage or rendering behavior;
- add automatic mailbox mutation;
- add external network calls for pin scoring;
- change wallet, Stellar, authentication, or database code;
- change shared design tokens or shared components from this issue.

## Follow-Up Issues Required

Open a separate integration issue before adding any of the following:

- persistent pin storage;
- host inbox placement;
- route registration;
- account-level settings;
- server-side sync;
- mailbox provider writes;
- analytics;
- shared design-system updates.

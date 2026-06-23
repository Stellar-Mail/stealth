# Escalation Tool Test Plan

## Automated Check

Run from the repository root:

```bash
node tools/v2/team/escalation-tool/tests/documentation-contract.test.mjs
```

The contract test validates:

- README setup commands and local ownership boundary
- specs do not contain generated placeholder fragments
- fixtures include all expected escalation states
- fixture emails use `.test` domains
- review notes describe scope, safety, and known limitations

## Manual Review Checklist

- Confirm every changed file is under `tools/v2/team/escalation-tool/`.
- Confirm no route, inbox, wallet, Stellar, auth, database, or shared design
  system file is modified.
- Confirm fixtures are synthetic and do not contain real customer data.
- Confirm `blocked` examples explain why a conversation cannot be routed.
- Confirm future implementation guidance keeps services local to this folder.

## Future Automated Coverage

When routing logic is added, tests should cover:

- owner-team matching
- severity promotion
- SLA countdown thresholds
- blocked states for missing owner or malformed input
- resolved conversations staying closed unless reopened

## Out Of Scope

- Main app integration.
- Live notifications.
- Production inbox data.
- Team directory lookups.
- SLA service calls.

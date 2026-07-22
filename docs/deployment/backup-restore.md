# Backup and Restore

## Recovery Objectives

| Objective | Target | Notes |
|-----------|--------|-------|
| Recovery Point Objective (RPO) | 1 hour | Maximum data loss in the event of a failure |
| Recovery Time Objective (RTO) | 4 hours | Maximum time to restore service |

## Backup Schedule

| Data Type | Frequency | Retention | Method |
|-----------|-----------|-----------|--------|
| Postage records | Hourly | 7 years | Full export to cold storage |
| Receipt records | Daily | 30 days | Incremental snapshot |
| Audit logs | Hourly | 7 years | Append-only export |
| Idempotency records | Not backed up | 24h TTL | Recreated on demand |
| Configuration | On change | 90 days | Version-controlled |

## Restore Procedure

### Prerequisites
- Access to backup storage
- Admin API key
- Clean deployment environment

### Steps
1. Deploy a fresh API instance (do not initialize)
2. Restore configuration from latest backup
3. Restore postage records (most recent first)
4. Restore receipt records
5. Restore audit logs
6. Run restore verification

## Restore Verification

Automated verification checks:
- Postage record count matches backup manifest
- Receipt record integrity verified via checksums
- Audit log sequence is unbroken
- No secrets or personal data exposed in logs

## Security
- All backups are encrypted at rest
- Restore operations require admin authentication
- Restore logs must not contain secrets or personal data
- Verification runs in a non-production environment

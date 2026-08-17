# Team Inbox Rules Builder Security Notes

## Threat assumptions

This tool accepts user-defined rule definitions and email content that may be malformed or intentionally hostile.

Potential risks include:

- oversized email bodies
- oversized subjects
- excessive rule counts
- excessive condition groups
- excessive conditions
- expensive regular expressions
- invalid regex syntax
- unexpected null/undefined values

## Validation

The executor rejects:

- oversized mail bodies
- oversized subjects
- excessive rule collections
- excessive condition groups
- excessive conditions

The rule engine rejects:

- unsafe regular expressions
- regex patterns exceeding configured limits

## Future work

Future integrations should:

- evaluate rules inside worker threads
- enforce execution timeouts
- stream large attachments
- cache compiled regexes

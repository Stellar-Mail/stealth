# Security and Performance

## Security

This tool:

- Uses only synthetic fixture data.
- Performs no authentication.
- Does not access external services.
- Does not persist data.
- Does not modify mail content.

## Performance

Current fixture validation executes locally using Node.js.

The implementation performs no network requests and has no external runtime dependencies.

Future optimization can be evaluated when the tool is integrated with the mail application.
